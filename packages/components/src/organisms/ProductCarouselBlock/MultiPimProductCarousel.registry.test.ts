import { describe, expect, it } from 'vitest'

import type { RenderContext, ResolvedProduct } from '@amplience/frontend-starter-types'

import type { MultiPimProductCarouselSchema } from './MultiPimProductCarousel.registry'
import {
  multiPimProductCarouselRegistryEntry as entry,
  MULTI_PIM_PRODUCT_CAROUSEL_SCHEMA,
} from './MultiPimProductCarousel.registry'
import { productCarouselRegistryEntry } from './ProductCarouselBlock.registry'

const product = (sku: string): ResolvedProduct => ({
  sku,
  slug: sku.toLowerCase(),
  name: sku,
  href: `/products/${sku.toLowerCase()}`,
})

const schema: MultiPimProductCarouselSchema = {
  _meta: { schema: MULTI_PIM_PRODUCT_CAROUSEL_SCHEMA },
  products: { cms: ['CMS-1', 'CMS-2'], commercetools: ['ct-id-1'] },
}

const ctx = (productSource?: string): RenderContext => ({
  products: new Map(['CMS-1', 'CMS-2', 'ct-id-1'].map((s) => [s, product(s)])),
  ...(productSource !== undefined && { productSource }),
})

describe('multiPimProductCarouselRegistryEntry', () => {
  it('renders the same component as the product carousel', () => {
    expect(entry.component).toBe(productCarouselRegistryEntry.component)
  })

  it("collects only the site's own source's list", () => {
    expect(entry.referencedSkus?.(schema, ctx('commercetools'))).toEqual(['ct-id-1'])
    expect(entry.referencedSkus?.(schema, ctx('cms'))).toEqual(['CMS-1', 'CMS-2'])
  })

  it('treats a site that names no source as the CMS one', () => {
    expect(entry.referencedSkus?.(schema, ctx())).toEqual(['CMS-1', 'CMS-2'])
  })

  it("renders the site's own list", () => {
    const props = entry.propsFromSchema?.(schema, ctx('commercetools'))
    expect(props?.products.map((p) => p.sku)).toEqual(['ct-id-1'])
  })

  it('renders an empty rail for a source the carousel has no list for', () => {
    expect(entry.propsFromSchema?.(schema, ctx('shopify'))?.products).toEqual([])
    expect(entry.referencedSkus?.(schema, ctx('shopify'))).toEqual([])
  })
})
