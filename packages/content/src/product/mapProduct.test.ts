import { describe, expect, it } from 'vitest'

import { IMAGE_LINK_SCHEMA } from '../types'
import { mapProduct } from './mapProduct'

const base = { sku: 'SKU-1', name: 'A Product' }

const imageLink = {
  _meta: { schema: IMAGE_LINK_SCHEMA },
  id: 'asset-1',
  name: 'chair-front',
  endpoint: 'acmedemo',
  defaultHost: 'cdn.media.amplience.net',
}

describe('mapProduct — required fields', () => {
  it('maps a minimal product', () => {
    expect(mapProduct(base, 'a-product')).toEqual({
      sku: 'SKU-1',
      slug: 'a-product',
      name: 'A Product',
    })
  })

  it('rejects a body with no sku', () => {
    expect(mapProduct({ name: 'A Product' }, 's')).toBeUndefined()
  })

  it('rejects a body with no name', () => {
    expect(mapProduct({ sku: 'SKU-1' }, 's')).toBeUndefined()
  })

  it('rejects a non-object body', () => {
    expect(mapProduct(undefined, 's')).toBeUndefined()
    expect(mapProduct('not a product', 's')).toBeUndefined()
  })

  it('rejects an unresolved localized name rather than emitting an object', () => {
    // What a read with no locale preference hands back. `Product.name` is a
    // string by contract, so this must not slip through as `[object Object]`.
    const body = { ...base, name: { values: [{ locale: 'en-US', value: 'A Product' }] } }
    expect(mapProduct(body, 's')).toBeUndefined()
  })
})

describe('mapProduct — images', () => {
  it('maps a ManualImage to its src, keeping the body for the DI path', () => {
    const media = {
      mediaType: 'ManualImage',
      image: { src: 'https://example.invalid/a.jpg', alt: 'A chair', width: 800, height: 600 },
    }
    const product = mapProduct({ ...base, images: [media] }, 's')
    expect(product?.images?.[0]).toEqual({
      url: 'https://example.invalid/a.jpg',
      alt: 'A chair',
      width: 800,
      height: 600,
      media,
    })
  })

  it('maps a DynamicImage through the Dynamic Media URL', () => {
    const media = {
      mediaType: 'DynamicImage',
      imageAltText: 'Chair, front',
      image: { image: imageLink, width: 1600, height: 1200 },
    }
    const product = mapProduct({ ...base, images: [media] }, 's')
    expect(product?.images?.[0]?.url).toBe('https://cdn.media.amplience.net/i/acmedemo/chair-front')
    expect(product?.images?.[0]?.alt).toBe('Chair, front')
    expect(product?.images?.[0]?.width).toBe(1600)
  })

  it('drops a DynamicImage whose asset link is missing or malformed', () => {
    const media = { mediaType: 'DynamicImage', image: { image: { name: 'incomplete' } } }
    expect(mapProduct({ ...base, images: [media] }, 's')?.images).toBeUndefined()
  })

  it('drops a ManualImage with no src', () => {
    const media = { mediaType: 'ManualImage', image: { alt: 'no src' } }
    expect(mapProduct({ ...base, images: [media] }, 's')?.images).toBeUndefined()
  })

  it('drops an unrecognised media type', () => {
    expect(
      mapProduct({ ...base, images: [{ mediaType: 'DynamicVideo' }] }, 's')?.images,
    ).toBeUndefined()
  })

  it('keeps the good images when one entry is unmappable', () => {
    const good = { mediaType: 'ManualImage', image: { src: 'https://example.invalid/a.jpg' } }
    const product = mapProduct({ ...base, images: [{ mediaType: 'nonsense' }, good] }, 's')
    expect(product?.images).toHaveLength(1)
  })

  it('ignores a non-array images field', () => {
    expect(mapProduct({ ...base, images: 'nope' }, 's')?.images).toBeUndefined()
  })
})

describe('mapProduct — prices', () => {
  const gbp = { amount: 19.99, currencyCode: 'GBP' }
  const eur = { amount: 23.5, currencyCode: 'EUR' }

  it('maps the whole price set', () => {
    expect(mapProduct({ ...base, prices: [gbp, eur] }, 's')?.prices).toEqual([gbp, eur])
  })

  it('selects the requested currency', () => {
    expect(mapProduct({ ...base, prices: [gbp, eur] }, 's', 'EUR')?.price).toEqual(eur)
  })

  it('selects the first price when no currency is requested', () => {
    // A single-currency catalogue needs no configuration to show its price.
    expect(mapProduct({ ...base, prices: [gbp, eur] }, 's')?.price).toEqual(gbp)
  })

  it('never substitutes another currency', () => {
    const product = mapProduct({ ...base, prices: [eur] }, 's', 'GBP')
    expect(product?.price).toBeUndefined()
    // The set is still there — the component could show EUR if it chose to.
    expect(product?.prices).toEqual([eur])
  })

  it('de-duplicates by currency so selection is order-independent', () => {
    // The schema can't express "unique by currencyCode", so two GBP rows are
    // authorable; first wins, deterministically.
    const dupes = [gbp, { amount: 99, currencyCode: 'GBP' }]
    expect(mapProduct({ ...base, prices: dupes }, 's', 'GBP')?.price).toEqual(gbp)
  })

  it('drops a price missing its currency, rather than rendering a bare number', () => {
    expect(mapProduct({ ...base, prices: [{ amount: 19.99 }] }, 's')?.prices).toBeUndefined()
  })

  it('drops a non-finite price rather than rendering NaN', () => {
    expect(
      mapProduct({ ...base, prices: [{ amount: NaN, currencyCode: 'GBP' }] }, 's')?.prices,
    ).toBeUndefined()
  })

  it('ignores a non-array prices field', () => {
    expect(mapProduct({ ...base, prices: 'nope' }, 's')?.prices).toBeUndefined()
  })
})

describe('mapProduct — optional fields', () => {
  it('maps attributes and drops incomplete pairs', () => {
    const attributes = [{ label: 'Material', value: 'Oak' }, { label: 'Missing value' }]
    expect(mapProduct({ ...base, attributes }, 's')?.attributes).toEqual([
      { label: 'Material', value: 'Oak' },
    ])
  })

  it('keeps only string tags', () => {
    expect(mapProduct({ ...base, tags: ['oak', 7, null, 'lounge'] }, 's')?.tags).toEqual([
      'oak',
      'lounge',
    ])
  })

  it('accepts the three known statuses and ignores anything else', () => {
    expect(mapProduct({ ...base, status: 'coming-soon' }, 's')?.status).toBe('coming-soon')
    expect(mapProduct({ ...base, status: 'in-stock' }, 's')?.status).toBeUndefined()
  })

  it('carries editorial slots through as content', () => {
    const slots = [{ _meta: { schema: 'x' } }]
    expect(mapProduct({ ...base, slots }, 's')?.content).toEqual(slots)
  })
})
