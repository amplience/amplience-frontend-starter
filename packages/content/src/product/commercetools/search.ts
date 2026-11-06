/**
 * commercetools Product Search (`POST /{projectKey}/products/search`) — the
 * request shapes this adapter sends and the slice of the response it reads.
 *
 * Product Search answers "which products, in what order, how many" and
 * returns ids only; the products themselves come from Product Projections in
 * a second call. That is what turns a listing from "page through 4,000 full
 * records" into "one search + one fetch of 48".
 *
 * Not the Product *Projection* Search that Quadratic 1.0 used: that API is
 * deprecated — projects created after August 2026 cannot enable it. Both need
 * activating per project and switch themselves off after 30 days unused, so
 * the source treats search as an accelerator with a fallback, never a
 * requirement.
 *
 * Reference: https://docs.commercetools.com/api/projects/product-search
 */

/** Product Search's page-size ceiling. */
export const MAX_SEARCH_LIMIT = 100

/** Product Search pages no deeper than this many results. */
export const MAX_SEARCH_WINDOW = 10_000

/** Distinct-facet bucket ceiling; a full result means the list may be cut short. */
export const MAX_FACET_BUCKETS = 200

export type SearchSort = { readonly field: string; readonly order: 'asc' | 'desc' }

export type SearchRequest = {
  readonly query?: unknown
  readonly sort?: readonly SearchSort[]
  readonly limit: number
  readonly offset?: number
  readonly facets?: readonly unknown[]
}

export type SearchFacetResult = {
  readonly name: string
  readonly buckets: readonly { readonly key: string; readonly count: number }[]
}

export type SearchResponse = {
  readonly total: number
  readonly offset: number
  readonly limit: number
  readonly results: readonly { readonly id: string }[]
  readonly facets?: readonly SearchFacetResult[]
}

/**
 * Newest first. The full-catalogue fallback reads Product Projections in the
 * same order (`createdAt desc`), so a listing does not reshuffle when search
 * switches on or off underneath it.
 */
export const NEWEST_FIRST: readonly SearchSort[] = [{ field: 'createdAt', order: 'desc' }]

/**
 * One page of a listing. A category matches its whole subtree — the same
 * "ancestors are denormalised" rule the port states — and is ordered by the
 * merchandiser's category order hints, with unhinted products after.
 */
export const listingRequest = ({
  categoryId,
  limit,
  offset,
}: {
  readonly categoryId?: string | undefined
  readonly limit: number
  readonly offset: number
}): SearchRequest => ({
  ...(categoryId === undefined
    ? {}
    : { query: { exact: { field: 'categoriesSubTree', value: categoryId } } }),
  sort:
    categoryId === undefined
      ? NEWEST_FIRST
      : [{ field: `categoryOrderHints.${categoryId}`, order: 'asc' }, ...NEWEST_FIRST],
  limit,
  offset,
})

/** No products — only the ids of every category that holds at least one. */
export const categoryFacetRequest = (): SearchRequest => ({
  limit: 0,
  facets: [{ distinct: { name: 'categories', field: 'categories', limit: MAX_FACET_BUCKETS } }],
})

/** The category ids in a facet response, or `undefined` if it may be truncated. */
export const facetCategoryIds = (response: SearchResponse): readonly string[] | undefined => {
  const buckets = response.facets?.find((f) => f.name === 'categories')?.buckets ?? []
  if (buckets.length >= MAX_FACET_BUCKETS) return undefined
  return buckets.filter((b) => b.count > 0).map((b) => b.key)
}
