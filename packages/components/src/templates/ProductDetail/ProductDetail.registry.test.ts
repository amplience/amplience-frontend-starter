import { describe, expect, it } from 'vitest'

import type { RenderContext } from '@amplience/frontend-starter-types'

import {
  PRODUCT_SCHEMA,
  productMetadataFromSchema,
  productRegistryEntry,
  type ProductSchema,
} from './ProductDetail.registry'

const ctx: RenderContext = {}

const schema = (over: Partial<ProductSchema> = {}): ProductSchema => ({
  _meta: {},
  sku: 'AUR-CHAIR-01',
  name: 'Aurora Lounge Chair',
  ...over,
})

describe('productRegistryEntry', () => {
  it('dispatches on the product schema URI', () => {
    expect(PRODUCT_SCHEMA).toBe('https://quadratic.amplience.com/v2/content/product')
  })

  it('declares consumesLoadPriority', () => {
    // It renders media (the gallery lead image) *and* has children, so
    // without this the PDP emits two 'lcp' nodes — ADR-0021 §3.
    expect(productRegistryEntry.consumesLoadPriority).toBe(true)
  })

  it('hands slots back as children', () => {
    const slots = [{ id: 'a' }, { id: 'b' }]
    expect(productRegistryEntry.getChildren?.(schema({ slots }))).toEqual(slots)
  })

  it('returns no children for a product with no editorial slots', () => {
    expect(productRegistryEntry.getChildren?.(schema())).toEqual([])
  })

  it('does not pass category identifiers to the template', () => {
    // They are opaque — the labels and hierarchy live with the navigation,
    // not in content, so there is nothing sensible to render from them.
    const props = productRegistryEntry.propsFromSchema?.(
      schema({ categories: ['home', 'home-seating'] }),
      ctx,
    )
    expect(props).not.toHaveProperty('category')
    expect(props).not.toHaveProperty('categories')
  })

  it('maps the delivery body to props', () => {
    const props = productRegistryEntry.propsFromSchema?.(
      schema({
        price: { amount: 749, currencyCode: 'GBP' },
        shortDescription: 'A low-slung chair.',
        brand: 'Aurora',
        categories: ['home', 'home-seating'],
        status: 'active',
      }),
      ctx,
    )
    expect(props?.name).toBe('Aurora Lounge Chair')
    expect(props?.price).toEqual({ amount: 749, currencyCode: 'GBP' })
    expect(props?.brand).toBe('Aurora')
  })

  it('drops a half-specified price rather than passing a partial object', () => {
    const props = productRegistryEntry.propsFromSchema?.(schema({ price: { amount: 749 } }), ctx)
    expect(props?.price).toBeUndefined()
  })

  it('drops incomplete attribute pairs', () => {
    const props = productRegistryEntry.propsFromSchema?.(
      schema({ attributes: [{ label: 'Frame', value: 'Oak' }, { label: 'Orphan' }] }),
      ctx,
    )
    expect(props?.attributes).toEqual([{ label: 'Frame', value: 'Oak' }])
  })

  it('omits attributes entirely when none survive', () => {
    const props = productRegistryEntry.propsFromSchema?.(
      schema({ attributes: [{ label: 'Orphan' }] }),
      ctx,
    )
    expect(props?.attributes).toBeUndefined()
  })

  it('takes loadPriority from the render context, defaulting to lazy', () => {
    expect(productRegistryEntry.propsFromSchema?.(schema(), {})?.loadPriority).toBe('lazy')
    expect(
      productRegistryEntry.propsFromSchema?.(schema(), { loadPriority: 'lcp' })?.loadPriority,
    ).toBe('lcp')
  })

  it('renders an empty heading rather than crashing on a nameless product', () => {
    // The schema marks `name` required, so this is a malformed item rather
    // than an authored state — built by omission, since
    // `exactOptionalPropertyTypes` won't let it be passed as `undefined`.
    const nameless: ProductSchema = { _meta: {}, sku: 'AUR-CHAIR-01' }
    expect(productRegistryEntry.propsFromSchema?.(nameless, ctx)?.name).toBe('')
  })
})

describe('productMetadataFromSchema', () => {
  it('falls back to the product name for the title', () => {
    // An author who fills the Product tab and skips Metadata should still get
    // a sensible <title>.
    expect(productMetadataFromSchema(schema()).title).toBe('Aurora Lounge Chair')
  })

  it('prefers an explicit title', () => {
    expect(productMetadataFromSchema(schema({ title: 'Explicit' })).title).toBe('Explicit')
  })

  it('falls back to the short description for the meta description', () => {
    const meta = productMetadataFromSchema(schema({ shortDescription: 'A chair.' }))
    expect(meta.description).toBe('A chair.')
  })

  it('uses the supplied path as the canonical when content sets none', () => {
    const meta = productMetadataFromSchema(schema(), { path: '/products/aurora' })
    expect(meta.alternates?.canonical).toBe('/products/aurora')
  })

  it('lets content override the canonical', () => {
    const meta = productMetadataFromSchema(schema({ canonicalUrl: '/elsewhere' }), {
      path: '/products/aurora',
    })
    expect(meta.alternates?.canonical).toBe('/elsewhere')
  })

  it('maps robots flags, treating absence as indexable and followable', () => {
    expect(productMetadataFromSchema(schema({ robots: { noindex: true } })).robots).toEqual({
      index: false,
      follow: true,
    })
  })

  it('emits no openGraph block when there is nothing to put in it', () => {
    expect(productMetadataFromSchema(schema()).openGraph).toBeUndefined()
  })
})
