import type {
  ComponentRegistryEntry,
  RenderContext,
  ResolvedProduct,
} from '@amplience/frontend-starter-types'

import { ProductCarouselBlock, type ProductCarouselBlockProps } from './ProductCarouselBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const PRODUCT_CAROUSEL_SCHEMA = 'https://quadratic.amplience.com/v2/content/product-carousel'

/**
 * The product-carousel delivery body — the block's own props minus the ones
 * the renderer supplies, plus the authored `products` — SKUs or product ids.
 *
 * `products` is a string array rather than content links: a PIM-backed deployment
 * has no content item to link to, so identifiers are the only reference that
 * survives swapping the source (ADR-0027 §1).
 */
export type ProductCarouselSchema = Omit<
  ProductCarouselBlockProps,
  'products' | 'locale' | 'localeBasePath' | 'loadPriority'
> & {
  readonly _meta: unknown
  readonly products?: readonly string[]
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
  referencedSkus: (schema) => schema.products ?? [],
  propsFromSchema: (schema, ctx) => productCarouselProps(schema, ctx),
}

/**
 * Body → props, shared with the multi-PIM carousel, which narrows its body to
 * one product list and then renders exactly as this does.
 */
export function productCarouselProps(
  { _meta: _envelope, products: references, ...props }: ProductCarouselSchema,
  ctx: RenderContext,
): ProductCarouselBlockProps {
  const resolved = ctx.products
  const products = (references ?? [])
    .map((reference) => resolved?.get(reference))
    .filter((p): p is ResolvedProduct => p !== undefined)

  return {
    ...props,
    products,
    ...(ctx.locale !== undefined && { locale: ctx.locale }),
    ...(ctx.localeBasePath !== undefined && { localeBasePath: ctx.localeBasePath }),
    ...(ctx.loadPriority !== undefined && { loadPriority: ctx.loadPriority }),
  }
}
