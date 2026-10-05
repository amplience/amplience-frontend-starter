/**
 * The ProductSource port — the integration seam established by ADR-0018.
 *
 * Routes, templates, `generateMetadata` and `generateStaticParams` depend on
 * this interface, never on a concrete source. v1.1 ships one implementation
 * (`CmsProductSource`, over a `ContentClient`); a commercetools adapter later
 * implements the same port and the swap is a configuration change.
 *
 * The port speaks **slugs and SKUs**, never delivery keys — a delivery key is
 * a CMS adapter's business, and a PIM-backed deployment has slugs with no
 * keys behind them. It is read-only for the same reason `ContentClient` is
 * (ADR-0008): writes are management-side and live elsewhere.
 *
 * Deliberately narrow. The surface is what *every* source can honestly do;
 * anything beyond it is advertised through `capabilities` so a consumer asks
 * rather than assumes. A superset interface would force this first adapter to
 * stub or throw on half its methods, which makes "implements the port" a
 * claim that means nothing.
 */

import type {
  CurrencyCode,
  Product,
  ProductListOptions,
  ProductListResult,
  SourceCapabilities,
} from './product-types'

export type ProductSource = {
  /**
   * Fetch one product by its URL slug (`"aurora-lounge-chair"`), including
   * any editorial content the source carries.
   *
   * Throws `ContentClientError('not-found', …)` if no product matches — one
   * error taxonomy across the package, discriminated with
   * `isContentClientError`.
   */
  getBySlug(
    slug: string,
    opts?: { readonly locale?: string; readonly currency?: CurrencyCode },
  ): Promise<Product>

  /**
   * Fetch products by SKU, for content that references products by identity
   * rather than by listing — a curated carousel, a related-products rail.
   *
   * Returns only the SKUs that resolved, in the order requested, so an
   * unpublished or mistyped SKU degrades to a shorter rail rather than an
   * error. Implementations pass the misses through `warnOnMissingSkus`,
   * which warns outside production and stays silent in it — the same
   * dev-loud/prod-quiet shape the blog archive uses for duplicate slugs.
   */
  getBySkus(
    skus: readonly string[],
    opts?: { readonly locale?: string; readonly currency?: CurrencyCode },
  ): Promise<readonly Product[]>

  /**
   * List the catalogue. `limit`/`offset` are advisory: a source reporting
   * `capabilities.pagination === false` may fetch everything and slice, so
   * do not rely on them to bound work against a large catalogue.
   */
  list(opts?: ProductListOptions): Promise<ProductListResult>

  /**
   * Every product slug the source can serve.
   *
   * Separate from `list` because route enumeration needs slugs and nothing
   * else — a PIM adapter can serve this from a cheap endpoint instead of
   * paging the whole catalogue to throw away all but one field.
   */
  listSlugs(): Promise<readonly string[]>

  /**
   * Every category identifier the source can serve, as a flat set (ADR-0024).
   *
   * Flat and unordered by contract: identifiers are opaque and carry no
   * relationship to one another. A source that exposed a tree here would be
   * asserting a taxonomy, which is the thing ADR-0018 Decision §8 rules out —
   * ancestor browsing works instead because ancestors are denormalised onto
   * each product's `categories`.
   *
   * Required rather than capability-gated: a source with no categories
   * returns `[]`, which is a real answer (those URLs 404), not a missing
   * feature. Routing consults this to decide whether a URL segment names a
   * category at all, so an adapter that omitted it would make every category
   * URL a 404 with nothing to indicate why.
   */
  listCategories(): Promise<readonly string[]>

  /** What this source can do. See `SourceCapabilities`. */
  readonly capabilities: SourceCapabilities
}
