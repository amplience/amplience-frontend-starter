/**
 * Normalised product shapes for the `ProductSource` port (ADR-0018).
 *
 * `Product` is the contract, not the schema. Adapters map their source into
 * it — a CMS content body, a commercetools payload, a stub — and nothing
 * above the port sees a delivery `_meta`, a delivery key, or a PIM field
 * name. Everything beyond `sku`/`slug`/`name` is optional so a richer
 * adapter is an additive change rather than a breaking one.
 *
 * What may be added here later is governed by ADR-0018 §8: a field a real
 * PIM would *overwrite* is fine; a field a real PIM would have to be
 * *reconciled* with (a taxonomy, a variant graph, a product-type schema) is
 * not, because that turns adopting a PIM into a content migration.
 */

import type { ContentBody, ContentItem } from './types'

/**
 * Editorial lifecycle — deliberately not stock. Availability is PIM/OMS-owned
 * and volatile; publication state is something the CMS is the authority for.
 */
export type ProductStatus = 'active' | 'coming-soon' | 'discontinued'

/**
 * A price as data, formatted at render time with `Intl.NumberFormat`.
 *
 * `amount` is in **major units** (19.99, not 1999) — matching Shopify's
 * `MoneyV2.amount`, BigCommerce and SFCC, and matching what a CMS author
 * types. commercetools is the outlier: its `centAmount` is minor units, so
 * that adapter divides by `10 ** fractionDigits` on the way in.
 *
 * Display only — never sum these. Major units in a JS `number` carry the
 * usual binary-float error, which is harmless for formatting one value and
 * is not harmless for arithmetic. Anything that needs totals wants a decimal
 * string (Shopify's choice) or minor-unit integers, and that is a decision
 * for whoever makes this accelerator transactional.
 */
export type ProductPrice = {
  readonly amount: number
  readonly currencyCode: string
}

/**
 * A product image, shaped after the commerce mainstream: commercetools
 * (`url` + `label` + `dimensions`), Shopify (`url` + `altText` + `width` +
 * `height`), BigCommerce and SFCC all hand back a URL and never a CMS asset
 * object. `url` is therefore required and every adapter can fill it.
 *
 * `media` is the Amplience enrichment on top — the delivery media body, kept
 * because it is what preserves the Dynamic Media path (the DI loader and its
 * aspect-ratio handling, ADR-0021). The CMS adapter fills both; a PIM adapter
 * fills `url` alone. Components render from `media` when present and fall
 * back to `url`, so there is always a working path and the branch is an
 * optimisation rather than a correctness concern.
 *
 * Components narrow `media` to `ContentMediaData` at their own boundary —
 * the port stays free of renderer types.
 */
export type ProductImage = {
  readonly url: string
  readonly alt?: string
  readonly width?: number
  readonly height?: number
  readonly media?: ContentBody
}

/** A display-only spec row. Label/value pairs, no schema, no units model. */
export type ProductAttribute = {
  readonly label: string
  readonly value: string
}

/** The normalised product every adapter returns. */
export type Product = {
  readonly sku: string
  readonly slug: string
  readonly name: string
  /**
   * The price for the requested currency. Mirrors commercetools, whose
   * `ProductVariant.price` is the one matching the price-selection
   * parameters and is absent until you supply them — selection there happens
   * server-side, and a PIM adapter should not have to redo it client-side.
   * Undefined when the source has no price in the requested currency.
   */
  readonly price?: ProductPrice
  /**
   * Every price the source holds, in no particular order. The counterpart to
   * `price`, again mirroring commercetools' `prices[]`. Optional because a
   * source that selects server-side may not return the full set cheaply.
   *
   * This is what makes "two currencies on one page" a component change rather
   * than a data-model change — the set is already here.
   */
  readonly prices?: readonly ProductPrice[]
  readonly images?: readonly ProductImage[]
  readonly shortDescription?: string
  readonly attributes?: readonly ProductAttribute[]
  readonly category?: string
  readonly tags?: readonly string[]
  readonly status?: ProductStatus
  /**
   * Resolved editorial content composed below the product detail — the slots
   * a CMS product carries. A PIM-backed adapter may fill this from a separate
   * CMS lookup keyed by `sku`, which is how "PIM supplies the facts, Amplience
   * supplies the story" works through one interface rather than two paths.
   */
  readonly content?: readonly ContentItem[]
}

/** Options for a catalogue listing. All optional; all advisory. */
export type ProductListOptions = {
  readonly locale?: string
  /** Currency to select a price for. See `CurrencyCode`. */
  readonly currency?: CurrencyCode
  /** Free-text category match, when the source can filter on it. */
  readonly category?: string
  readonly limit?: number
  readonly offset?: number
}

export type ProductListResult = {
  readonly products: readonly Product[]
  /** Total matching the query before `limit`/`offset`, when the source knows it. */
  readonly total?: number
}

/**
 * What a source can honestly do. Consumers branch on these rather than
 * assuming, so a search box or facet rail renders only where it can be
 * served and the first PIM lights it up without a route change.
 */
export type SourceCapabilities = {
  readonly search: boolean
  readonly facets: boolean
  readonly pagination: boolean
  readonly variants: boolean
  readonly realtimePricing: boolean
  readonly inventory: boolean
  /** Whether this source holds prices in more than one currency. */
  readonly multiCurrency: boolean
}

/** Capability baseline — spread and override the few a source supports. */
export const NO_CAPABILITIES: SourceCapabilities = {
  search: false,
  facets: false,
  pagination: false,
  variants: false,
  realtimePricing: false,
  inventory: false,
  multiCurrency: false,
}
