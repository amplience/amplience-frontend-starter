import type { ComponentRegistryEntry, ResolvedProduct } from '@amplience/frontend-starter-types'

import { ProductCarouselBlock, type ProductCarouselBlockProps } from './ProductCarouselBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const PRODUCT_CAROUSEL_SCHEMA = 'https://quadratic.amplience.com/v2/content/product-carousel'

/**
 * The product-carousel delivery body — the block's own props minus the ones
 * the renderer supplies, plus the authored `skus`.
 *
 * `skus` is a string array rather than content links: a PIM-backed deployment
 * has no content item to link to, so identifiers are the only reference that
 * survives swapping the source (ADR-0027 §1).
 */
export type ProductCarouselSchema = Omit<
  ProductCarouselBlockProps,
  'products' | 'locale' | 'localeBasePath' | 'loadPriority'
> & {
  readonly _meta: unknown
  readonly skus?: readonly string[]
}

/**
 * Registry entry for the product-carousel schema.
 *
 * A leaf entry despite having contents: the slides are products, not content
 * nodes, so there is nothing for the dispatcher to recurse into. `referencedSkus`
 * is what the pre-pass reads; `ctx.products` is what it leaves behind.
 *
 * Order comes from the content, not from the resolved set — the author's
 * sequence is the merchandising decision. SKUs that did not resolve drop out,
 * shortening the rail rather than failing it.
 */
export const productCarouselRegistryEntry: ComponentRegistryEntry<
  ProductCarouselSchema,
  ProductCarouselBlockProps
> = {
  component: ProductCarouselBlock,
  referencedSkus: (schema) => schema.skus ?? [],
  propsFromSchema: ({ _meta: _envelope, skus, ...props }, ctx) => {
    const resolved = ctx.products
    const products = (skus ?? [])
      .map((sku) => resolved?.get(sku))
      .filter((p): p is ResolvedProduct => p !== undefined)

    return {
      ...props,
      products,
      ...(ctx.locale !== undefined && { locale: ctx.locale }),
      ...(ctx.localeBasePath !== undefined && { localeBasePath: ctx.localeBasePath }),
      ...(ctx.loadPriority !== undefined && { loadPriority: ctx.loadPriority }),
    }
  },
}
