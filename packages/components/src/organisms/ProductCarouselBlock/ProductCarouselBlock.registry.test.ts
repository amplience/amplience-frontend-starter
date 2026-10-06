// Tests for the product-carousel registry entry (ADR-0027) — the adapter reads
// products the renderer resolved before dispatch, so the interesting cases are
// ordering, misses, and an absent map.

import { describe, expect, it } from 'vitest'

import type { RenderContext, ResolvedProduct } from '@amplience/frontend-starter-types'

import {
  PRODUCT_CAROUSEL_SCHEMA,
  productCarouselRegistryEntry,
  type ProductCarouselSchema,
} from './ProductCarouselBlock.registry'

const product = (sku: string): ResolvedProduct => ({
  sku,
  slug: sku.toLowerCase(),
  name: sku,
  href: `/products/${sku.toLowerCase()}`,
})

const resolved = (...skus: string[]): RenderContext => ({
  products: new Map(skus.map((sku) => [sku, product(sku)])),
})

const schema = (...skus: string[]) =>
  ({ _meta: { schema: PRODUCT_CAROUSEL_SCHEMA }, skus }) as ProductCarouselSchema

const adapt = (s: ProductCarouselSchema, ctx: RenderContext) =>
  productCarouselRegistryEntry.propsFromSchema?.(s, ctx)

describe('productCarouselRegistryEntry — referencedSkus', () => {
  it('declares the SKUs the pre-pass should resolve', () => {
    expect(productCarouselRegistryEntry.referencedSkus?.(schema('A', 'B'))).toEqual(['A', 'B'])
  })

  it('declares none when the field is absent', () => {
    const bare = { _meta: { schema: PRODUCT_CAROUSEL_SCHEMA } } as ProductCarouselSchema
    expect(productCarouselRegistryEntry.referencedSkus?.(bare)).toEqual([])
  })

  it('is not a container — slides are products, not content nodes', () => {
    expect(productCarouselRegistryEntry.getChildren).toBeUndefined()
  })
})

describe('productCarouselRegistryEntry — propsFromSchema', () => {
  it('strips the envelope and the raw SKUs from the props', () => {
    const props = adapt(schema('A'), resolved('A'))
    expect(props).not.toHaveProperty('_meta')
    expect(props).not.toHaveProperty('skus')
  })

  it('orders products by the content, not by the resolved map', () => {
    // The author's sequence is the merchandising decision.
    const props = adapt(schema('C', 'A', 'B'), resolved('A', 'B', 'C'))
    expect(props?.products.map((p) => p.sku)).toEqual(['C', 'A', 'B'])
  })

  it('drops SKUs that did not resolve, keeping the rest in order', () => {
    const props = adapt(schema('A', 'GONE', 'B'), resolved('A', 'B'))
    expect(props?.products.map((p) => p.sku)).toEqual(['A', 'B'])
  })

  it('yields no products when the context carries no map at all', () => {
    // A route that forgot the pre-pass gets an empty rail, not a crash.
    expect(adapt(schema('A'), {})?.products).toEqual([])
  })

  it('keeps the authored presentation fields', () => {
    const configured = {
      ...schema('A'),
      slidesDesktop: 5,
      showDots: true,
      backgroundColor: 'light',
    } as ProductCarouselSchema
    const props = adapt(configured, resolved('A'))
    expect(props).toMatchObject({ slidesDesktop: 5, showDots: true, backgroundColor: 'light' })
  })

  it('takes locale, localeBasePath and loadPriority from the render context', () => {
    const props = adapt(schema('A'), {
      ...resolved('A'),
      locale: 'fr-FR',
      localeBasePath: '/fr-fr',
      loadPriority: 'eager',
    })
    expect(props).toMatchObject({
      locale: 'fr-FR',
      localeBasePath: '/fr-fr',
      loadPriority: 'eager',
    })
  })

  it('passes the locale on, so prices format identically on server and client', () => {
    // Omitting it leaves `Intl` on each runtime's own default — which differ,
    // and surface as a hydration mismatch rather than as a wrong price.
    expect(adapt(schema('A'), { ...resolved('A'), locale: 'en-GB' })?.locale).toBe('en-GB')
  })
})
