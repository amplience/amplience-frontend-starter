/**
 * Resolved products keyed by every reference content may use for them.
 *
 * Content references a product by SKU or, when its source has one, by the
 * source's own id — the eComm Toolkit picker stores commercetools product ids.
 * Keying the map by both lets a rail look up whichever it holds.
 */

import type { ResolvedProduct } from '@amplience/frontend-starter-types'

export const productMap = (
  products: Iterable<ResolvedProduct>,
): ReadonlyMap<string, ResolvedProduct> => {
  const map = new Map<string, ResolvedProduct>()
  for (const product of products) {
    map.set(product.sku, product)
    if (product.id !== undefined) map.set(product.id, product)
  }
  return map
}

/** Each product once — a map keyed by SKU *and* id holds most products twice. */
export const uniqueProducts = (
  map: ReadonlyMap<string, ResolvedProduct>,
): readonly ResolvedProduct[] => [...new Set(map.values())]
