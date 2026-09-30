/**
 * `ProductSource` backed by CMS content — implementation #1 (ADR-0018).
 *
 * Composes over a `ContentClient` rather than talking to Amplience itself,
 * so it inherits the mock/SDK split for free: fixtures offline, a hub when
 * one is configured, and the same code path either way.
 *
 * The site prefix is a constructor argument, never read from the
 * environment. The composition boundary already owns that resolution, and an
 * adapter that reads env is an adapter that can't be tested twice with
 * different sites — which is exactly what cross-set isolation needs testing
 * for (ADR-0019 puts two fixture sets on one hub).
 *
 * Almost every capability is false. A CMS catalogue has no search, no facets,
 * no server-side pagination, no variants, no live pricing and no stock; saying
 * so is what lets a consumer light those up when a PIM adapter arrives without
 * a route change. `multiCurrency` is the exception — every authored price is
 * present, so selection is a local filter.
 */

import type { ContentClient } from '../port'
import type { ProductSource } from '../product-port'
import type {
  CurrencyCode,
  Product,
  ProductListOptions,
  ProductListResult,
  SourceCapabilities,
} from '../product-types'
import { NO_CAPABILITIES } from '../product-types'
import { ContentClientError } from '../types'
import type { ContentItem } from '../types'
import { catalogueFromItems, warnOnDuplicateSlugs } from './catalogue'
import { mapProduct } from './mapProduct'
import { missingSkus, warnOnMissingSkus } from './warnings'

/** The product content type's schema URI — the Filter API dispatch key. */
export const PRODUCT_SCHEMA = 'https://quadratic.amplience.com/v2/content/product'

/**
 * Preference list used when a caller asks for no particular locale.
 *
 * Every read here maps to a `Product`, whose `name` must be a string — so a
 * read that omits the locale gets back `{ values: [...] }` objects and every
 * product fails its required-field check. `'*'` is the wildcard the delivery
 * locale grammar already defines (see `localized.ts`): take the first
 * available value. It is what makes "list the catalogue" work without the
 * caller having to know about locales at all, and it matches the convention
 * that the preference list always terminates in a wildcard so a value is
 * always produced.
 */
const ANY_LOCALE = '*'

export type CmsProductSourceOptions = {
  readonly client: ContentClient
  /** Delivery-key namespace for this deployment (ADR-0014). */
  readonly siteName: string
}

export class CmsProductSource implements ProductSource {
  // Multi-currency is the one thing a CMS catalogue genuinely can do: every
  // price the author wrote is present, so selection is a local filter rather
  // than a second request.
  readonly capabilities: SourceCapabilities = { ...NO_CAPABILITIES, multiCurrency: true }

  readonly #client: ContentClient
  readonly #siteName: string

  constructor({ client, siteName }: CmsProductSourceOptions) {
    this.#client = client
    this.#siteName = siteName
  }

  /**
   * One product, with its editorial slots resolved.
   *
   * Fetched by key at `depth: 'all'` rather than filtered out of a list read:
   * a detail page needs the whole tree, and the key is derivable, so there is
   * no reason to page the catalogue to find one item.
   */
  async getBySlug(
    slug: string,
    opts?: { readonly locale?: string; readonly currency?: CurrencyCode },
  ): Promise<Product> {
    const key = this.#keyFor(slug)
    const item = await this.#client.getByKey<Record<string, unknown>>(key, {
      depth: 'all',
      locale: opts?.locale ?? ANY_LOCALE,
    })

    const product = mapProduct(item, slug, opts?.currency)
    if (!product) {
      throw new ContentClientError(
        'malformed',
        `Product "${key}" is missing a sku or a name, both of which its schema requires.`,
      )
    }
    return product
  }

  async getBySkus(
    skus: readonly string[],
    opts?: { readonly locale?: string; readonly currency?: CurrencyCode },
  ): Promise<readonly Product[]> {
    if (skus.length === 0) return []

    const all = await this.#catalogue(opts?.locale, opts?.currency)
    const bySku = new Map(all.map((p) => [p.sku, p]))
    const resolved = skus.map((sku) => bySku.get(sku)).filter((p): p is Product => p !== undefined)
    warnOnMissingSkus(missingSkus(skus, resolved))
    return resolved
  }

  /**
   * `limit`/`offset` are applied after the fact — `capabilities.pagination`
   * is false precisely because the Filter API has no notion of a page of
   * *products*, so the read is whole-catalogue either way. `total` is the
   * count before slicing, which is what a pager needs.
   */
  async list(opts: ProductListOptions = {}): Promise<ProductListResult> {
    const all = await this.#catalogue(opts.locale, opts.currency)
    // Exact membership, not a prefix or a tree walk: ancestors are
    // denormalised onto each product (see `Product.categories`), so asking for
    // `mens` already returns everything beneath it.
    const { category } = opts
    const matching = category ? all.filter((p) => p.categories?.includes(category)) : all

    const offset = opts.offset ?? 0
    const products =
      opts.limit === undefined
        ? matching.slice(offset)
        : matching.slice(offset, offset + opts.limit)

    return { products, total: matching.length }
  }

  async listSlugs(): Promise<readonly string[]> {
    // Delivery keys are not localized, so one read serves every locale's
    // route enumeration.
    const { entries } = await this.#read()
    return entries.map((e) => e.slug)
  }

  /**
   * The category set, derived rather than authored (ADR-0024).
   *
   * `distinct()` over the `categories` values already on the products — so
   * the CMS holds no category list, and there is no second place for one to
   * drift from. Publishing a product into a new category is what creates
   * that category.
   *
   * Sorted only so enumeration and tests are deterministic; the contract is
   * a set, and no caller may read meaning into the order.
   */
  async listCategories(): Promise<readonly string[]> {
    const all = await this.#catalogue()
    return [...new Set(all.flatMap((p) => p.categories ?? []))].sort()
  }

  #keyFor(slug: string): string {
    return `${this.#siteName}/products/${slug}`
  }

  async #read(locale?: string) {
    const items = await this.#client.listBySchema<ContentItem<Record<string, unknown>>>(
      PRODUCT_SCHEMA,
      { locale: locale ?? ANY_LOCALE },
    )
    const catalogue = catalogueFromItems(items, this.#siteName)
    warnOnDuplicateSlugs(catalogue.duplicateSlugs)
    return catalogue
  }

  /**
   * The site's products, in catalogue order. Items the mapper rejects are
   * dropped: one product missing its required fields shouldn't empty a
   * listing page.
   */
  async #catalogue(locale?: string, currency?: CurrencyCode): Promise<readonly Product[]> {
    const { entries } = await this.#read(locale)
    return entries
      .map((e) => mapProduct(e.item, e.slug, currency))
      .filter((p): p is Product => p !== undefined)
  }
}
