import { describe, expect, it, vi } from 'vitest'

import { makeMockContentClient } from '../mock'
import type { ContentClient } from '../port'
import { isContentClientError } from '../types'
import type { ContentItem } from '../types'
import { CmsProductSource, PRODUCT_SCHEMA } from './CmsProductSource'
import { describeProductSource } from './conformance'

/** `console` via globalThis — this package compiles without DOM/node types. */
const globalConsole = (globalThis as unknown as { console: { warn: (m: string) => void } }).console

const source = () =>
  new CmsProductSource({ client: makeMockContentClient(), siteName: 'base-site' })

// The contract every source must satisfy, run against the real fixtures.
describeProductSource('CmsProductSource', () => ({
  source: source(),
  knownSlug: 'aurora-lounge-chair',
  knownSku: 'AUR-CHAIR-01',
  emptySource: new CmsProductSource({
    client: makeMockContentClient(),
    siteName: 'no-such-site',
  }),
}))

// ---------------------------------------------------------------------------
// CMS-specific behaviour — delivery keys, site scoping, mapping fidelity.
// ---------------------------------------------------------------------------

/** A client returning exactly the items given, for scoping tests. */
const clientOf = (items: readonly unknown[]): ContentClient => ({
  getByKey: () => Promise.reject(new Error('not used')),
  getById: () => Promise.reject(new Error('not used')),
  listBySchema: <T>() => Promise.resolve(items as readonly ContentItem<T>[]),
  getHierarchy: () => Promise.reject(new Error('not used')),
})

const productItem = (key: string, sku: string, name: string, deliveryId = sku) => ({
  _meta: {
    schema: PRODUCT_SCHEMA,
    deliveryId,
    deliveryKeys: { values: [{ value: key }] },
  },
  sku,
  name,
})

describe('CmsProductSource — delivery keys', () => {
  it('reads a product by its {site}/products/{slug} key', async () => {
    const getByKey = vi.fn().mockResolvedValue(productItem('acme/products/x', 'X', 'X'))
    const client = { ...clientOf([]), getByKey } as unknown as ContentClient
    await new CmsProductSource({ client, siteName: 'acme' }).getBySlug('x')

    expect(getByKey).toHaveBeenCalledWith('acme/products/x', { depth: 'all', locale: '*' })
  })

  it('requests depth:all so editorial slots arrive resolved', async () => {
    const product = await source().getBySlug('aurora-lounge-chair')
    expect(product.content).toBeDefined()
    expect(product.content?.length).toBeGreaterThan(0)
  })

  it('passes the locale through to the client', async () => {
    const getByKey = vi.fn().mockResolvedValue(productItem('acme/products/x', 'X', 'X'))
    const client = { ...clientOf([]), getByKey } as unknown as ContentClient
    await new CmsProductSource({ client, siteName: 'acme' }).getBySlug('x', { locale: 'fr-FR' })

    expect(getByKey).toHaveBeenCalledWith('acme/products/x', { depth: 'all', locale: 'fr-FR' })
  })
})

describe('CmsProductSource — site scoping', () => {
  it('excludes another site on the same hub (ADR-0019 puts two sets on one hub)', async () => {
    const client = clientOf([
      productItem('site/products/mine', 'MINE', 'Mine'),
      productItem('site-two/products/theirs', 'THEIRS', 'Theirs'),
    ])
    const { products } = await new CmsProductSource({ client, siteName: 'site' }).list()
    expect(products.map((p) => p.sku)).toEqual(['MINE'])
  })

  it('matches on prefix, not substring — "site" must not swallow "site-two"', async () => {
    const client = clientOf([productItem('site-two/products/theirs', 'THEIRS', 'Theirs')])
    const { products } = await new CmsProductSource({ client, siteName: 'site' }).list()
    expect(products).toEqual([])
  })

  it('excludes items of the same type published outside the products namespace', async () => {
    const client = clientOf([productItem('site/campaigns/promo', 'PROMO', 'Promo')])
    const { products } = await new CmsProductSource({ client, siteName: 'site' }).list()
    expect(products).toEqual([])
  })
})

describe('CmsProductSource — duplicate slugs', () => {
  it('keeps one product per slug and warns', async () => {
    const client = clientOf([
      productItem('site/products/dup', 'A', 'Dup', 'id-b'),
      productItem('site/products/dup', 'B', 'Dup', 'id-a'),
    ])
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    try {
      const { products } = await new CmsProductSource({ client, siteName: 'site' }).list()
      expect(products).toHaveLength(1)
      // Stable tiebreak: lowest delivery id wins, every render.
      expect(products[0]?.sku).toBe('B')
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain('dup')
    } finally {
      warn.mockRestore()
    }
  })
})

describe('CmsProductSource — mapping', () => {
  it('maps the full fixture faithfully', async () => {
    const product = await source().getBySlug('aurora-lounge-chair')
    expect(product.sku).toBe('AUR-CHAIR-01')
    expect(product.price).toEqual({ amount: 749, currencyCode: 'GBP' })
    expect(product.prices).toEqual([
      { amount: 749, currencyCode: 'GBP' },
      { amount: 869, currencyCode: 'EUR' },
      { amount: 949, currencyCode: 'USD' },
    ])
    expect(product.images).toHaveLength(6)
    expect(product.images?.[0]?.url).toContain('picsum.photos')
    expect(product.attributes?.length).toBeGreaterThan(0)
    expect(product.status).toBe('active')
  })

  it('serves the empty-state product — no price, no images, no attributes', async () => {
    const product = await source().getBySlug('aurora-shelving')
    expect(product.price).toBeUndefined()
    expect(product.images).toBeUndefined()
    expect(product.attributes).toBeUndefined()
    expect(product.status).toBe('coming-soon')
  })

  it('leaves `content` undefined for a product with no editorial slots', async () => {
    const product = await source().getBySlug('lumen-floor-lamp')
    expect(product.content).toBeUndefined()
  })

  it('rejects a body missing the fields its schema requires', async () => {
    const getByKey = vi.fn().mockResolvedValue({ _meta: { schema: PRODUCT_SCHEMA }, sku: 'X' })
    const client = { ...clientOf([]), getByKey } as unknown as ContentClient
    const error = await new CmsProductSource({ client, siteName: 'acme' }).getBySlug('x').then(
      () => undefined,
      (e: unknown) => e,
    )

    expect(isContentClientError(error)).toBe(true)
    expect((error as { kind: string }).kind).toBe('malformed')
  })

  it('drops an unmappable item rather than emptying the listing', async () => {
    const client = clientOf([
      productItem('site/products/good', 'GOOD', 'Good'),
      {
        _meta: {
          schema: PRODUCT_SCHEMA,
          deliveryKeys: { values: [{ value: 'site/products/bad' }] },
        },
      },
    ])
    const { products } = await new CmsProductSource({ client, siteName: 'site' }).list()
    expect(products.map((p) => p.sku)).toEqual(['GOOD'])
  })
})

describe('CmsProductSource — listing', () => {
  it('orders by name so the order is one an editor can predict', async () => {
    const { products } = await source().list()
    const names = products.map((p) => p.name)
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)
  })

  it('filters by an exact category identifier', async () => {
    const { products, total } = await source().list({ category: 'home-tables' })
    expect(products.length).toBeGreaterThan(0)
    expect(products.every((p) => p.categories?.includes('home-tables'))).toBe(true)
    expect(total).toBe(products.length)
  })

  it('matches an ancestor because ancestors are denormalised onto the product', () => {
    // No tree walk: a product in `home-tables` also lists `home`, which is
    // what commercetools recommends and what makes this an exact match.
    return source()
      .list({ category: 'home' })
      .then(({ products }) => {
        expect(products.length).toBeGreaterThan(1)
      })
  })

  it('reports the pre-slice total alongside a limited page', async () => {
    const all = await source().list()
    const page = await source().list({ limit: 2 })
    expect(page.products).toHaveLength(2)
    expect(page.total).toBe(all.products.length)
  })

  it('resolves localized fields when no locale is asked for', async () => {
    // Without a preference list the delivery body hands back raw
    // `{ values }` objects, `name` is not a string, and every product fails
    // its required-field check — the catalogue silently empties. The adapter
    // defaults to the `*` wildcard so a locale-less caller still gets names.
    const { products } = await source().list()
    expect(products.length).toBeGreaterThan(0)
    expect(products.every((p) => typeof p.name === 'string' && p.name.length > 0)).toBe(true)
  })

  it('advertises multiCurrency and nothing else', () => {
    // Every authored price is present, so currency selection is a local
    // filter — the one thing a CMS catalogue genuinely does.
    const { multiCurrency, ...rest } = source().capabilities
    expect(multiCurrency).toBe(true)
    expect(Object.values(rest).every((v) => v === false)).toBe(true)
  })

  it.each(['GBP', 'EUR', 'USD'])('selects %s across the catalogue', (currency) => {
    return source()
      .list({ currency })
      .then(({ products }) => {
        const priced = products.filter((p) => p.price !== undefined)
        expect(priced.length).toBeGreaterThan(0)
        expect(priced.every((p) => p.price?.currencyCode === currency)).toBe(true)
      })
  })
})
