import type { ComponentRegistryEntry, ContentMediaData } from '@amplience/frontend-starter-types'

import { contentMediaUrl } from '../../molecules/DynamicImage/di-utils'
import { ProductDetail, type ProductDetailProps } from './ProductDetail'

/** The schema URI this entry dispatches on (ADR-0010 §3 — no aliasing). */
export const PRODUCT_SCHEMA = 'https://quadratic.amplience.com/v2/content/product'

/** A localized-resolved attribute pair as it arrives in the delivery body. */
type ProductAttributeSchema = {
  readonly label?: string
  readonly value?: string
}

/**
 * The product delivery body.
 *
 * Note this is the *CMS* shape, not the normalised `Product` the
 * `ProductSource` port returns (ADR-0018). The registry dispatches on a
 * content item, so a product opened in the CMS visualization renders through
 * this adapter; the `/products/[slug]` route renders the same template from a
 * `Product` instead. The two paths converge on `ProductDetailProps`, which is
 * why the props contract is deliberately source-agnostic.
 */
export type ProductSchema = {
  readonly _meta: unknown
  readonly title?: string
  readonly description?: string
  readonly keywords?: readonly string[]
  readonly social?: {
    readonly title?: string
    readonly description?: string
    readonly image?: ContentMediaData
  }
  readonly canonicalUrl?: string
  readonly robots?: { readonly noindex?: boolean; readonly nofollow?: boolean }
  readonly sku?: string
  readonly name?: string
  readonly price?: { readonly amount?: number; readonly currencyCode?: string }
  readonly shortDescription?: string
  readonly status?: 'active' | 'coming-soon' | 'discontinued'
  readonly images?: readonly ContentMediaData[]
  readonly attributes?: readonly ProductAttributeSchema[]
  readonly brand?: string
  readonly categories?: readonly string[]
  readonly tags?: readonly string[]
  readonly slots?: readonly unknown[]
}

/**
 * Map a product content item to head metadata — same shape as
 * `pageMetadataFromSchema` and `blogArticleMetadataFromSchema`, so a route's
 * `generateMetadata` can return the result directly.
 *
 * `title` falls back to the product name: an author who fills in the Product
 * tab and skips the Metadata tab should still get a sensible `<title>`, and
 * on a PDP the product name is exactly what that should be.
 */
export const productMetadataFromSchema = (
  schema: ProductSchema,
  opts: { readonly path?: string } = {},
) => {
  const social = schema.social
  const title = schema.title ?? schema.name
  const description = schema.description ?? schema.shortDescription
  const ogTitle = social?.title ?? title
  const ogDescription = social?.description ?? description
  // Social image wins; the lead product image is the natural fallback. Cap DI
  // variants at 1200px (the Open Graph recommended width).
  const ogImageSource = social?.image ?? schema.images?.[0]
  const ogImage =
    ogImageSource === undefined ? undefined : contentMediaUrl(ogImageSource, { width: 1200 })
  const canonical = schema.canonicalUrl ?? opts.path

  return {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(schema.keywords !== undefined &&
      schema.keywords.length > 0 && { keywords: [...schema.keywords] }),
    ...(social !== undefined || ogImageSource !== undefined
      ? {
          openGraph: {
            ...(ogTitle !== undefined && { title: ogTitle }),
            ...(ogDescription !== undefined && { description: ogDescription }),
            ...(ogImage !== undefined && { images: [ogImage] }),
          },
        }
      : {}),
    ...(canonical !== undefined && { alternates: { canonical } }),
    ...(schema.robots !== undefined && {
      robots: {
        index: !(schema.robots.noindex ?? false),
        follow: !(schema.robots.nofollow ?? false),
      },
    }),
  }
}

/** Keep only attribute pairs that have both halves — see `mapProduct`. */
const completeAttributes = (
  attributes: readonly ProductAttributeSchema[],
): readonly { label: string; value: string }[] =>
  attributes.flatMap((a) =>
    a.label !== undefined && a.value !== undefined ? [{ label: a.label, value: a.value }] : [],
  )

/**
 * Registry entry for the product schema. A container entry: `getChildren`
 * hands the product's `slots` to the renderer, which renders them recursively
 * and passes the result in as `children`.
 *
 * It declares `consumesLoadPriority` for the same reason `BlogArticle` does —
 * it renders media of its own (the gallery's lead image, a PDP's LCP element
 * in practice) *and* has children. Without it the page would carry two `'lcp'`
 * nodes and preload the product image against the first editorial block.
 */
export const productRegistryEntry: ComponentRegistryEntry<ProductSchema, ProductDetailProps> = {
  component: ProductDetail,
  consumesLoadPriority: true,
  propsFromSchema: (schema, ctx) => {
    const attributes =
      schema.attributes === undefined ? undefined : completeAttributes(schema.attributes)
    const price =
      schema.price?.amount !== undefined && schema.price.currencyCode !== undefined
        ? { amount: schema.price.amount, currencyCode: schema.price.currencyCode }
        : undefined

    return {
      // A product with no name is a content error the schema already forbids;
      // an empty heading is a more legible failure than a crash.
      name: schema.name ?? '',
      loadPriority: ctx.loadPriority ?? 'lazy',
      ...(price !== undefined && { price }),
      ...(schema.images !== undefined && { images: schema.images }),
      ...(schema.shortDescription !== undefined && {
        shortDescription: schema.shortDescription,
      }),
      ...(attributes !== undefined && attributes.length > 0 && { attributes }),
      ...(schema.brand !== undefined && { brand: schema.brand }),
      ...(schema.tags !== undefined && { tags: schema.tags }),
      ...(schema.status !== undefined && { status: schema.status }),
    }
  },
  getChildren: (schema) => schema.slots ?? [],
}
