/**
 * `ProductSource` backed by commercetools — implementation #2 (ADR-0018).
 *
 * Reads published Product Projections over the HTTP API. Routes see the same
 * port as `CmsProductSource`; switching is `PRODUCT_SOURCE=commercetools`.
 *
 * Read strategy:
 *
 *  - **`getBySlug` and `getBySkus` query Product Projections directly**, so a
 *    product page and an editorial carousel always see current data.
 *  - **A paged `list` and `listCategories` use Product Search** (`search.ts`)
 *    when the project has it active: one search for the page's ids (a
 *    category matches its subtree, ordered by category order hints), then one
 *    fetch of just those products; categories come from a facet. A listing
 *    costs two small requests, whatever the catalogue size.
 *  - **Everything else falls back to the whole catalogue**, read once and
 *    filtered locally behind a TTL cache: an unpaged `list`, `listSlugs`, and
 *    any read while search is inactive. Search is an accelerator, never a
 *    requirement — it needs activating per project and switches itself off
 *    after 30 days unused, and a demo must not break when that happens.
 *  - Categories and product types are lookup tables (identifiers, ancestors,
 *    attribute labels) and share the same cache.
 *
 * Slugs are read in **one** locale (`slugLocale`). The port has one slug per
 * product while commercetools localises them; picking a locale per request
 * would give a product a different URL per locale and break `listSlugs`.
 *
 * Every SKU on a product resolves to it — master and variants — because the
 * port has no variants and an editor pasting a variant SKU into a carousel
 * means "this product". The returned `sku` is always the master's.
 */

import type { ProductSource } from '../../product-port'
import type {
  CurrencyCode,
  Product,
  ProductListOptions,
  ProductListResult,
  SourceCapabilities,
} from '../../product-types'
import { NO_CAPABILITIES } from '../../product-types'
import { ContentClientError, isContentClientError } from '../../types'
import { warnOnMissingCurrency } from '../selectPrice'
import { warnOnMissingSkus } from '../warnings'
import type { CommercetoolsClient, PagedQueryResponse, QueryParams } from './client'
import { MAX_PAGE_SIZE } from './client'
import { localePreferences } from './localize'
import type { MappingContext } from './mapProjection'
import { categoryIdentifier, mapProjection, skusOf } from './mapProjection'
import type { SearchRequest, SearchResponse } from './search'
import {
  categoryFacetRequest,
  facetCategoryIds,
  listingRequest,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_WINDOW,
} from './search'
import type { CtCategory, CtProductProjection, CtProductType } from './wire'

export type CommercetoolsProductSourceOptions = {
  readonly client: CommercetoolsClient
  /** The locale slugs are read in — a key present on every product's `slug`. Default `en`. */
  readonly slugLocale?: string
  /**
   * Country for price selection. Unset, it is derived from the request
   * locale's region (`en-GB` → `GB`). Country-scoped prices — which is how
   * most projects price — are only selected when a country is sent.
   */
  readonly priceCountry?: string
  /** Attribute names read as the brand, first present wins. Default `brand`, `designer`. */
  readonly brandAttributes?: readonly string[]
  /** Attribute read as the short description. Default `shortDescription`. */
  readonly shortDescriptionAttribute?: string
  /**
   * Use Product Search for paged listings and the category list when the
   * project has it active. Default true; false always reads the catalogue.
   */
  readonly productSearch?: boolean
  /** How long catalogue and lookup reads are reused. Default 60s; 0 disables. */
  readonly cacheTtlMs?: number
  /** Clock, for tests. */
  readonly now?: () => number
}

const DEFAULT_TTL_MS = 60_000

/** How long to stop asking an inactive Product Search before trying again. */
const SEARCH_RECHECK_MS = 5 * 60_000

/** Projections fetched per id-list request (keeps the `where` predicate short). */
const IDS_PER_FETCH = 100

// `process` and `console` via globalThis — see config.ts.
type Globals = {
  process?: { env?: Record<string, string | undefined> }
  console?: { warn?: (message: string) => void }
}
const globals = globalThis as Globals

type ReadOpts = { readonly locale?: string; readonly currency?: CurrencyCode }

export class CommercetoolsProductSource implements ProductSource {
  /**
   * `multiCurrency` is true because every variant price is read, and the
   * mapper selects locally when server-side selection returns nothing.
   * `pagination` follows Product Search: true while it is serving pages,
   * false while listings fall back to slicing the whole catalogue.
   */
  get capabilities(): SourceCapabilities {
    return {
      ...NO_CAPABILITIES,
      multiCurrency: true,
      pagination: this.#productSearch && this.#searchDownUntil <= this.#now(),
    }
  }

  readonly #client: CommercetoolsClient
  readonly #slugLocale: string
  readonly #priceCountry: string | undefined
  readonly #brandAttributes: readonly string[]
  readonly #shortDescriptionAttribute: string
  readonly #productSearch: boolean
  readonly #now: () => number
  readonly #cache: TtlCache
  /** Until when Product Search is presumed inactive; 0 = not known to be. */
  #searchDownUntil = 0

  constructor(options: CommercetoolsProductSourceOptions) {
    this.#client = options.client
    this.#slugLocale = options.slugLocale ?? 'en'
    this.#priceCountry = options.priceCountry?.toUpperCase()
    this.#brandAttributes = options.brandAttributes ?? ['brand', 'designer']
    this.#shortDescriptionAttribute = options.shortDescriptionAttribute ?? 'shortDescription'
    this.#productSearch = options.productSearch ?? true
    this.#now = options.now ?? Date.now
    this.#cache = new TtlCache(options.cacheTtlMs ?? DEFAULT_TTL_MS, this.#now)
  }

  async getBySlug(slug: string, opts?: ReadOpts): Promise<Product> {
    const [ctx, page] = await Promise.all([
      this.#context(opts),
      this.#client.get<PagedQueryResponse<CtProductProjection>>('/product-projections', {
        ...this.#priceParams(opts),
        where: `slug(${this.#slugLocale} = ${quote(slug)})`,
        limit: 1,
      }),
    ])

    const projection = page.results[0]
    if (!projection) {
      throw new ContentClientError(
        'not-found',
        `No published commercetools product has slug "${slug}" in locale "${this.#slugLocale}".`,
      )
    }
    const product = mapProjection(projection, ctx)
    if (!product) {
      throw new ContentClientError(
        'malformed',
        `commercetools product ${projection.id} is missing a master-variant SKU or a name.`,
      )
    }
    if (!product.price) warnOnMissingCurrency(product.slug, opts?.currency, product.prices)
    return product
  }

  async getBySkus(skus: readonly string[], opts?: ReadOpts): Promise<readonly Product[]> {
    if (skus.length === 0) return []

    const list = [...new Set(skus)].map(quote).join(', ')
    const [ctx, page] = await Promise.all([
      this.#context(opts),
      this.#client.get<PagedQueryResponse<CtProductProjection>>('/product-projections', {
        ...this.#priceParams(opts),
        where: `masterVariant(sku in (${list})) or variants(sku in (${list}))`,
        limit: MAX_PAGE_SIZE,
      }),
    ])

    const bySku = new Map<string, Product>()
    for (const projection of page.results) {
      const product = mapProjection(projection, ctx)
      if (!product) continue
      for (const sku of skusOf(projection)) bySku.set(sku, product)
    }

    const resolved: Product[] = []
    const missing: string[] = []
    for (const sku of skus) {
      const product = bySku.get(sku)
      if (product) resolved.push(product)
      else missing.push(sku)
    }
    warnOnMissingSkus(missing)
    warnOnMissingCurrencies(opts?.currency, resolved)
    return resolved
  }

  /**
   * A page of the catalogue. Paged requests go through Product Search when it
   * is active; an unpaged one (or any while it is not) slices the whole
   * catalogue — the same order either way, so nothing reshuffles.
   */
  async list(opts: ProductListOptions = {}): Promise<ProductListResult> {
    if (opts.limit !== undefined) {
      const page = await this.#searchList({ ...opts, limit: opts.limit })
      if (page !== undefined) return page
    }
    return await this.#listFromCatalogue(opts)
  }

  async listSlugs(): Promise<readonly string[]> {
    return (await this.#catalogue()).map((p) => p.slug)
  }

  /**
   * Categories that hold at least one product, plus their ancestors — derived
   * from the products, like the CMS source (ADR-0024), not the category tree.
   *
   * From a Product Search facet when search is active: one request, no
   * products. Falls back to the catalogue when it is not, or when the facet
   * may have been cut short (200+ categories).
   */
  async listCategories(): Promise<readonly string[]> {
    const fromFacet = await this.#cache.get('category-facet', async () => {
      const response = await this.#search(categoryFacetRequest())
      return response === undefined ? undefined : facetCategoryIds(response)
    })
    if (fromFacet !== undefined) {
      const { categoriesById } = await this.#context(undefined)
      const ids = new Set<string>()
      for (const id of fromFacet) {
        const category = categoriesById.get(id)
        if (!category) continue
        ids.add(id)
        for (const ancestor of category.ancestors ?? []) ids.add(ancestor.id)
      }
      const identifiers = [...ids]
        .map((id) => categoriesById.get(id))
        .filter((c): c is CtCategory => c !== undefined)
        .map((c) => categoryIdentifier(c, this.#slugLocale))
      return [...new Set(identifiers)].sort()
    }
    const all = await this.#catalogue()
    return [...new Set(all.flatMap((p) => p.categories ?? []))].sort()
  }

  async #listFromCatalogue(opts: ProductListOptions): Promise<ProductListResult> {
    const all = await this.#catalogue(opts)
    const { category } = opts
    const matching = category ? all.filter((p) => p.categories?.includes(category)) : all

    const offset = opts.offset ?? 0
    const products =
      opts.limit === undefined
        ? matching.slice(offset)
        : matching.slice(offset, offset + opts.limit)
    return { products, total: matching.length }
  }

  /**
   * One page via Product Search: the ids (as many searches of ≤100 as the
   * limit needs), then those products in one or two projection fetches,
   * returned in search order. `undefined` when search is unavailable, so the
   * caller falls back.
   *
   * `total` is the search's count, which can include a product the mapper
   * then drops (no slug in the slug locale) — so a page may come up a card
   * short. The catalogue path's dropped-products warning names the cause.
   */
  async #searchList(
    opts: ProductListOptions & { readonly limit: number },
  ): Promise<ProductListResult | undefined> {
    if (!this.#productSearch || this.#searchDownUntil > this.#now()) return undefined

    const ctx = await this.#context(opts)
    let categoryId: string | undefined
    if (opts.category !== undefined) {
      categoryId = this.#categoryIdFor(opts.category, ctx)
      if (categoryId === undefined) return { products: [], total: 0 }
    }

    const started = this.#now()
    const ids: string[] = []
    let total = 0
    let offset = opts.offset ?? 0
    do {
      const size = Math.min(MAX_SEARCH_LIMIT, opts.limit - ids.length)
      if (offset + size > MAX_SEARCH_WINDOW) break
      const response = await this.#search(listingRequest({ categoryId, limit: size, offset }))
      if (response === undefined) return undefined
      total = response.total
      ids.push(...response.results.map((r) => r.id))
      offset += response.results.length
      if (response.results.length < size) break
    } while (ids.length < opts.limit)

    const projections = await this.#projectionsByIds(ids, opts)
    const byId = new Map(projections.map((p) => [p.id, p]))
    const products = ids
      .map((id) => byId.get(id))
      .filter((p): p is CtProductProjection => p !== undefined)
      .map((p) => mapProjection(p, ctx))
      .filter((p): p is Product => p !== undefined)
    devTiming(`searched ${products.length} of ${total} products`, this.#now() - started)
    warnOnMissingCurrencies(opts.currency, products)
    return { products, total }
  }

  /** Projections by id, in batches, with server-side price selection. */
  async #projectionsByIds(
    ids: readonly string[],
    opts: ReadOpts,
  ): Promise<readonly CtProductProjection[]> {
    const batches: string[][] = []
    for (let i = 0; i < ids.length; i += IDS_PER_FETCH)
      batches.push(ids.slice(i, i + IDS_PER_FETCH))
    const pages = await Promise.all(
      batches.map((batch) =>
        this.#client.get<PagedQueryResponse<CtProductProjection>>('/product-projections', {
          ...this.#priceParams(opts),
          where: `id in (${batch.map(quote).join(', ')})`,
          limit: batch.length,
        }),
      ),
    )
    return pages.flatMap((page) => page.results)
  }

  /** The commercetools id behind a category identifier, if any category has it. */
  #categoryIdFor(identifier: string, ctx: MappingContext): string | undefined {
    for (const category of ctx.categoriesById.values()) {
      if (categoryIdentifier(category, this.#slugLocale) === identifier) return category.id
    }
    return undefined
  }

  /**
   * A Product Search request, or `undefined` when search is off or inactive.
   *
   * An inactive project answers 404 (`ObjectNotFound`). That is remembered
   * for a few minutes — so a page doesn't pay a failed request per render —
   * then retried, so activating search in the Merchant Center takes effect
   * without a restart. Any other failure is a real error and propagates.
   */
  async #search(body: SearchRequest): Promise<SearchResponse | undefined> {
    if (!this.#productSearch || this.#searchDownUntil > this.#now()) return undefined
    try {
      return await this.#client.post<SearchResponse>('/products/search', body)
    } catch (error) {
      if (!isContentClientError(error) || error.kind !== 'not-found') throw error
      this.#searchDownUntil = this.#now() + SEARCH_RECHECK_MS
      warnSearchInactive()
      return undefined
    }
  }

  #priceParams(opts: ReadOpts | undefined): QueryParams {
    const country = this.#priceCountry ?? regionOf(opts?.locale)
    return {
      staged: false,
      ...(opts?.currency ? { priceCurrency: opts.currency } : {}),
      ...(opts?.currency && country ? { priceCountry: country } : {}),
    }
  }

  /**
   * The mapped catalogue for one locale + currency.
   *
   * Built from one shared raw read: prices are selected locally from each
   * variant's full price list, so a second locale or currency re-maps the
   * cached projections (milliseconds) instead of paging the project again.
   */
  async #catalogue(opts: ReadOpts = {}): Promise<readonly Product[]> {
    const key = `catalogue|${opts.locale ?? ''}|${opts.currency ?? ''}`
    return await this.#cache.get(key, async () => {
      const [ctx, projections] = await Promise.all([this.#context(opts), this.#projections()])
      const started = this.#now()
      const products = dedupeSlugs(
        projections.map((p) => mapProjection(p, ctx)).filter((p): p is Product => p !== undefined),
      )
      devTiming(`mapped ${products.length} products`, this.#now() - started)
      warnOnMissingCurrencies(opts.currency, products)
      return products
    })
  }

  async #projections(): Promise<readonly CtProductProjection[]> {
    return await this.#cache.get('projections', async () => {
      const started = this.#now()
      const projections = await this.#client.getAll<CtProductProjection>('/product-projections', {
        staged: false,
        // Product Search's listing order, so the fallback matches it.
        sort: ['createdAt desc', 'id asc'],
      })
      devTiming(`fetched ${projections.length} products from commercetools`, this.#now() - started)
      this.#warnOnDropped(projections)
      return projections
    })
  }

  async #context(opts: ReadOpts | undefined): Promise<MappingContext> {
    const [categories, productTypes] = await Promise.all([
      this.#cache.get('categories', () => this.#client.getAll<CtCategory>('/categories')),
      this.#cache.get('product-types', () => this.#client.getAll<CtProductType>('/product-types')),
    ])
    const country = this.#priceCountry ?? regionOf(opts?.locale)
    return {
      prefs: localePreferences(opts?.locale),
      slugLocale: this.#slugLocale,
      ...(opts?.currency ? { currency: opts.currency } : {}),
      ...(country ? { country } : {}),
      categoriesById: new Map(categories.map((c) => [c.id, c])),
      productTypesById: new Map(productTypes.map((t) => [t.id, t])),
      brandAttributes: this.#brandAttributes,
      shortDescriptionAttribute: this.#shortDescriptionAttribute,
      now: this.#now(),
    }
  }

  /**
   * Dev-loud when products were dropped. The usual cause is `slugLocale` not
   * matching the project's slug keys, which otherwise reads as "commercetools
   * has no products" — so the warning names the keys the project does use.
   */
  #warnOnDropped(projections: readonly CtProductProjection[]) {
    const dropped = projections.filter(
      (p) => !p.masterVariant.sku || !p.slug[this.#slugLocale] || Object.keys(p.name).length === 0,
    ).length
    if (dropped === 0) return
    if (globals.process?.env?.NODE_ENV === 'production') return
    const keys = [...new Set(projections.flatMap((p) => Object.keys(p.slug)))].sort()
    globals.console?.warn?.(
      `[products] ${dropped} of ${projections.length} commercetools product(s) were skipped for ` +
        `lacking a master-variant SKU, a name, or a slug in "${this.#slugLocale}". ` +
        `Slug locales in this project: ${keys.join(', ') || 'none'}. Set CTP_SLUG_LOCALE to one of them.`,
    )
  }
}

/**
 * Dev-loud note that listings fell back to the full catalogue. Product Search
 * is the difference between a ~20s and a sub-second listing on a large
 * project, so saying how to turn it on is worth a log line.
 */
const warnSearchInactive = (): void => {
  if (globals.process?.env?.NODE_ENV === 'production') return
  globals.console?.warn?.(
    "[products] commercetools Product Search isn't active on this project, so listings read the " +
      'whole catalogue (slow on large projects). Turn it on in the Merchant Center: Settings → ' +
      'Project settings → Storefront Search. It switches itself off after 30 days unused. ' +
      'Set CTP_PRODUCT_SEARCH=off to always use the catalogue and silence this.',
  )
}

/**
 * One summary line for products with no price in the requested currency —
 * the per-product warning the CMS source uses would be thousands of lines
 * against a real catalogue. Dev-loud, production-quiet, like the rest.
 */
const warnOnMissingCurrencies = (
  currency: CurrencyCode | undefined,
  products: readonly Product[],
): void => {
  if (currency === undefined) return
  if (globals.process?.env?.NODE_ENV === 'production') return
  const missing = products.filter((p) => !p.price && (p.prices?.length ?? 0) > 0)
  if (missing.length === 0) return

  const held = new Map<string, number>()
  for (const p of missing) {
    for (const { currencyCode } of p.prices ?? [])
      held.set(currencyCode, (held.get(currencyCode) ?? 0) + 1)
  }
  const summary = [...held.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${code} ×${n}`)
    .join(', ')
  globals.console?.warn?.(
    `[products] ${missing.length} of ${products.length} commercetools product(s) have no ${currency} ` +
      `price and will render without one (they hold: ${summary}). Prices are never substituted ` +
      `across currencies — map this locale to a held currency in PRODUCT_CURRENCIES.`,
  )
}

/**
 * Dev-only timing for the catalogue read — fetch vs map — so a slow listing
 * shows where its time went. Opt out with `CTP_TIMING=0`; never in production.
 */
const devTiming = (what: string, ms: number): void => {
  const env = globals.process?.env
  if (env?.NODE_ENV === 'production' || env?.CTP_TIMING === '0') return
  ;(globals.console as { info?: (m: string) => void } | undefined)?.info?.(
    `[products] ${what} in ${Math.round(ms)}ms`,
  )
}

/** `en-GB` → `GB` from the first preference that has a region. */
const regionOf = (locale: string | undefined): string | undefined => {
  for (const pref of localePreferences(locale)) {
    const region = pref.split('-')[1]
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase()
  }
  return undefined
}

/** A string literal for a commercetools query predicate. */
const quote = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * commercetools enforces slug uniqueness per locale, so this is a guard
 * rather than an expected path — but `listSlugs` promises unique slugs and a
 * route can only serve one product per URL, so the first wins.
 */
const dedupeSlugs = (products: readonly Product[]): Product[] => {
  const seen = new Set<string>()
  return products.filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)))
}

/**
 * Promise-memoising TTL cache. Concurrent reads of a cold key share one
 * request, and a rejected read is evicted so a transient failure is not
 * cached for the whole TTL.
 */
class TtlCache {
  readonly #ttl: number
  readonly #now: () => number
  readonly #entries = new Map<string, { readonly at: number; readonly value: Promise<unknown> }>()

  constructor(ttlMs: number, now: () => number) {
    this.#ttl = ttlMs
    this.#now = now
  }

  async get<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.#ttl <= 0) return await load()
    const hit = this.#entries.get(key)
    if (hit && this.#now() - hit.at < this.#ttl) return (await hit.value) as T

    const value = load()
    this.#entries.set(key, { at: this.#now(), value })
    value.catch(() => {
      if (this.#entries.get(key)?.value === value) this.#entries.delete(key)
    })
    return await value
  }
}
