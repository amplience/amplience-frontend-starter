import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import type { ProductCarouselBlockProps } from './ProductCarouselBlock'
import type { ProductCarouselSchema } from './ProductCarouselBlock.registry'
import { productCarouselProps, productCarouselRegistryEntry } from './ProductCarouselBlock.registry'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MULTI_PIM_PRODUCT_CAROUSEL_SCHEMA =
  'https://quadratic.amplience.com/v2/content/multi-pim-product-carousel'

/** The product source a site uses when it doesn't say — `PRODUCT_SOURCE`'s default. */
const DEFAULT_SOURCE = 'cms'

/**
 * The multi-PIM carousel's delivery body: the product carousel's, with one
 * product list per source (`cms`, `commercetools`, …) instead of one list.
 */
export type MultiPimProductCarouselSchema = Omit<ProductCarouselSchema, 'products'> & {
  readonly products?: Readonly<Record<string, readonly string[] | undefined>>
}

/**
 * Registry entry for the multi-PIM carousel — a demo tool for hubs whose sites
 * draw on different product sources. Each site shows the list for its own
 * source (`ctx.productSource`), so one carousel can feed a CMS-backed site and
 * a commercetools-backed one on the same hub.
 *
 * Renders exactly what the product carousel renders: it narrows the body to
 * the site's list and hands it to that entry, so there is one carousel
 * component however many sources there are.
 */
export const multiPimProductCarouselRegistryEntry: ComponentRegistryEntry<
  MultiPimProductCarouselSchema,
  ProductCarouselBlockProps
> = {
  component: productCarouselRegistryEntry.component,
  referencedSkus: (schema, ctx) => schema.products?.[ctx.productSource ?? DEFAULT_SOURCE] ?? [],
  propsFromSchema: ({ products, ...rest }, ctx) => {
    const own = products?.[ctx.productSource ?? DEFAULT_SOURCE]
    return productCarouselProps({ ...rest, ...(own !== undefined && { products: own }) }, ctx)
  },
}
