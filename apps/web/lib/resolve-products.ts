/**
 * Resolve the products a content tree references, for `ctx.products` (ADR-0027).
 *
 * The composition boundary owns this because it is where the source is already
 * composed: `packages/content` knows nothing about rendering, and
 * `packages/components` knows nothing about sources.
 *
 * One batched `getBySkus` per render, de-duplicated across the whole tree.
 * Misses are dropped by the port (dev-loud, prod-quiet), so a mistyped SKU
 * shortens a rail rather than failing a page.
 */

import type { Product } from '@amplience/frontend-starter-content'
import { isContentClientError } from '@amplience/frontend-starter-content'
import type { Registry, ResolvedProduct } from '@amplience/frontend-starter-types'

import { collectSkus } from '../src/renderer/collect-skus'
import { resolveCurrency } from './currency'
import type { Locale } from './locales'
import { publicPath } from './locales'
import { productMedia } from './product-media'
import { productSource } from './product-source'

const EMPTY: ReadonlyMap<string, ResolvedProduct> = new Map()

/** Port `Product` → the presentational shape components render. */
export const toResolvedProduct = (product: Product, locale: Locale): ResolvedProduct => {
  const media = productMedia(product.images?.[0])
  return {
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    href: publicPath(locale, `/products/${product.slug}`),
    ...(product.price !== undefined && { price: product.price }),
    ...(media !== undefined && { media }),
    ...(product.brand !== undefined && { brand: product.brand }),
    ...(product.shortDescription !== undefined && {
      shortDescription: product.shortDescription,
    }),
    ...(product.status !== undefined && { status: product.status }),
  }
}

/**
 * The resolved-product map for a tree, or an empty map when it references none.
 *
 * A failed resolve degrades to an empty map: the rails disappear but the page
 * around them is intact, which beats failing a whole page over a rail.
 */
export async function resolveProducts(
  content: unknown,
  registry: Registry,
  locale: Locale,
): Promise<ReadonlyMap<string, ResolvedProduct>> {
  return await resolveProductsBySku(collectSkus(content, registry), locale)
}

/**
 * The same resolve, for callers that already hold the SKUs — the products API
 * route, which serves the live-editing path that cannot await a port read.
 */
export async function resolveProductsBySku(
  skus: readonly string[],
  locale: Locale,
): Promise<ReadonlyMap<string, ResolvedProduct>> {
  if (skus.length === 0) return EMPTY

  try {
    const products = await productSource.getBySkus(skus, {
      locale: locale.delivery,
      currency: resolveCurrency(locale.code),
    })
    return new Map(products.map((p) => [p.sku, toResolvedProduct(p, locale)]))
  } catch (error) {
    if (!isContentClientError(error)) throw error
    return EMPTY
  }
}
