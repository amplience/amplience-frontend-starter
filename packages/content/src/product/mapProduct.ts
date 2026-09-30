/**
 * Delivery body → normalised `Product` (ADR-0018).
 *
 * The only place the CMS shape is known. Isolating it means the mapping is
 * unit-testable without a client, and that a leak — a `_meta`, a delivery
 * key, a media partial — reaching a component is a visible change to this
 * file rather than something that seeps through the adapter.
 *
 * Fields arrive already locale-resolved: the content client collapses
 * localized values before the body gets here, so `name` is a string, not a
 * `{ values }` object. Anything unreadable is dropped rather than coerced —
 * a product with a malformed price renders without one, which is a better
 * failure than `NaN` on a page.
 */

import type {
  CurrencyCode,
  Product,
  ProductAttribute,
  ProductImage,
  ProductPrice,
  ProductStatus,
} from '../product-types'
import type { ContentItem } from '../types'
import { isMediaImageLink, mediaImageUrl } from '../types'
import { selectPrice, warnOnMissingCurrency } from './selectPrice'

const STATUSES: readonly ProductStatus[] = ['active', 'coming-soon', 'discontinued']

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

const mapPrice = (v: unknown): ProductPrice | undefined => {
  const p = v as { amount?: unknown; currencyCode?: unknown } | undefined
  const amount = num(p?.amount)
  const currencyCode = str(p?.currencyCode)
  if (amount === undefined || currencyCode === undefined) return undefined
  return { amount, currencyCode }
}

/**
 * Every well-formed price on the body, de-duplicated by currency — a schema
 * can't express "unique by currencyCode", so two GBP rows are authorable and
 * would make selection depend on array order. First wins, deterministically.
 */
const mapPrices = (v: unknown): readonly ProductPrice[] => {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  return v.map(mapPrice).filter((p): p is ProductPrice => {
    if (p === undefined || seen.has(p.currencyCode)) return false
    seen.add(p.currencyCode)
    return true
  })
}

/**
 * One media-partial entry → `ProductImage`.
 *
 * Both branches produce a `url`, so consumers always have a working path:
 * ManualImage carries one directly, DynamicImage has its DAM asset resolved
 * through `mediaImageUrl`. The original body rides along as `media` so a
 * component can prefer the Dynamic Media path and its aspect-ratio handling
 * (ADR-0021) rather than the flat URL.
 */
const mapImage = (v: unknown): ProductImage | undefined => {
  const m = v as { mediaType?: unknown; image?: unknown; imageAltText?: unknown } | undefined
  if (!m || typeof m !== 'object') return undefined

  if (m.mediaType === 'ManualImage') {
    const img = m.image as
      { src?: unknown; alt?: unknown; width?: unknown; height?: unknown } | undefined
    const url = str(img?.src)
    if (url === undefined) return undefined
    return {
      url,
      ...(str(img?.alt) !== undefined ? { alt: str(img?.alt)! } : {}),
      ...(num(img?.width) !== undefined ? { width: num(img?.width)! } : {}),
      ...(num(img?.height) !== undefined ? { height: num(img?.height)! } : {}),
      media: m as ContentItem,
    }
  }

  if (m.mediaType === 'DynamicImage') {
    const field = m.image as { image?: unknown; width?: unknown; height?: unknown } | undefined
    if (!isMediaImageLink(field?.image)) return undefined
    return {
      url: mediaImageUrl(field.image),
      ...(str(m.imageAltText) !== undefined ? { alt: str(m.imageAltText)! } : {}),
      ...(num(field?.width) !== undefined ? { width: num(field?.width)! } : {}),
      ...(num(field?.height) !== undefined ? { height: num(field?.height)! } : {}),
      media: m as ContentItem,
    }
  }

  return undefined
}

const mapAttribute = (v: unknown): ProductAttribute | undefined => {
  const a = v as { label?: unknown; value?: unknown } | undefined
  const label = str(a?.label)
  const value = str(a?.value)
  if (label === undefined || value === undefined) return undefined
  return { label, value }
}

const mapStatus = (v: unknown): ProductStatus | undefined => STATUSES.find((s) => s === v)

const isPresent = <T>(v: T | undefined): v is T => v !== undefined

/**
 * Map a product delivery body to a `Product`. `slug` comes from the delivery
 * key, which the catalogue has already stripped to its final segment — the
 * body itself never carries one.
 *
 * Returns `undefined` when the body has no `sku` or no `name`: those are the
 * two fields the schema marks required and that nothing downstream can
 * sensibly substitute. Dropping such an item keeps one malformed product
 * from taking out a whole listing.
 */
export const mapProduct = (
  body: unknown,
  slug: string,
  currency?: CurrencyCode,
): Product | undefined => {
  const b = body as Record<string, unknown> | undefined
  if (!b || typeof b !== 'object') return undefined

  const sku = str(b.sku)
  const name = str(b.name)
  if (sku === undefined || name === undefined) return undefined

  const images = Array.isArray(b.images) ? b.images.map(mapImage).filter(isPresent) : []
  const attributes = Array.isArray(b.attributes)
    ? b.attributes.map(mapAttribute).filter(isPresent)
    : []
  const tags = Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === 'string') : []
  const slots = Array.isArray(b.slots) ? (b.slots as readonly ContentItem[]) : []

  const prices = mapPrices(b.prices)
  warnOnMissingCurrency(slug, currency, prices)
  const price = selectPrice(prices, currency)
  const shortDescription = str(b.shortDescription)
  const brand = str(b.brand)
  const categories = Array.isArray(b.categories)
    ? [...new Set(b.categories.filter((c): c is string => typeof c === 'string' && c.length > 0))]
    : []
  const status = mapStatus(b.status)

  return {
    sku,
    slug,
    name,
    ...(price !== undefined ? { price } : {}),
    ...(prices.length > 0 ? { prices } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(shortDescription !== undefined ? { shortDescription } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...(brand !== undefined ? { brand } : {}),
    ...(categories.length > 0 ? { categories } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(slots.length > 0 ? { content: slots } : {}),
  }
}
