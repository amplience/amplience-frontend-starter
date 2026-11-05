/**
 * commercetools `ProductProjection` → `Product` (ADR-0018).
 *
 * The one place commercetools field names exist. Everything here is a
 * narrowing: commercetools models far more than the port admits (variants,
 * channels, customer-group prices, typed attributes), and what does not fit
 * the port is dropped rather than smuggled through — a superset `Product`
 * would make the next PIM adapter's job a reconciliation (ADR-0018 §8).
 *
 * What maps to what:
 *
 *   masterVariant.sku               → sku       (variants' SKUs resolve to the
 *                                                product; see the source)
 *   slug[slugLocale]                → slug      (one URL per product)
 *   name / description              → name / shortDescription (locale prefs)
 *   masterVariant.price | prices[]  → price / prices (centAmount ÷ 10^digits)
 *   masterVariant.images[]          → images    (url, label, dimensions)
 *   masterVariant.attributes[]      → attributes (product-type labels) + brand
 *   categories[] + their ancestors  → categories (denormalised, as the port
 *                                                 and commercetools both ask)
 */

import type {
  CurrencyCode,
  Product,
  ProductAttribute,
  ProductImage,
  ProductPrice,
} from '../../product-types'
import { selectPrice } from '../selectPrice'
import { isLocalizedString, pickLocalized } from './localize'
import type {
  CtCategory,
  CtImage,
  CtPrice,
  CtProductProjection,
  CtProductType,
  CtTypedMoney,
} from './wire'

/** Lookups the mapper needs that are not on the projection itself. */
export type MappingContext = {
  /** Locale preference list for display text — see `localePreferences`. */
  readonly prefs: readonly string[]
  /** The one locale slugs are read in. */
  readonly slugLocale: string
  readonly currency?: CurrencyCode
  /** ISO 3166 country for picking between country-scoped prices. */
  readonly country?: string
  readonly categoriesById: ReadonlyMap<string, CtCategory>
  readonly productTypesById: ReadonlyMap<string, CtProductType>
  /** Attribute names read as the brand, first present wins. */
  readonly brandAttributes: readonly string[]
  /** Attribute read as `shortDescription`; commercetools has no native one. */
  readonly shortDescriptionAttribute: string
  /** Clock for price validity windows. Injected so tests are deterministic. */
  readonly now: number
}

/** The opaque identifier a category is addressed by — its URL segment. */
export const categoryIdentifier = (category: CtCategory, slugLocale: string): string =>
  category.slug[slugLocale] ?? category.key ?? category.id

/**
 * A product, or `undefined` when it lacks what the port requires (a SKU, a
 * name, or a slug in the configured locale). Dropping beats throwing: one
 * badly-imported product should not empty a listing.
 */
export const mapProjection = (
  projection: CtProductProjection,
  ctx: MappingContext,
): Product | undefined => {
  const variant = projection.masterVariant
  const sku = variant.sku
  const slug = projection.slug[ctx.slugLocale]
  const name = pickLocalized(projection.name, [...ctx.prefs, '*'])
  if (!sku || !slug || !name) return undefined

  const prices = mapPrices(variant.prices, ctx)
  // No missing-currency warning here: across a large catalogue it would be one
  // line per product, so the source reports a single summary instead.
  const price = effective(variant.price) ?? selectPrice(prices, ctx.currency)

  const images = (variant.images ?? []).flatMap(mapImage)
  // commercetools' `description` is long-form copy, so it is `description`,
  // never `shortDescription` — that comes only from an attribute, if the
  // project has one, and is otherwise left blank rather than faked.
  const description = pickLocalized(projection.description, [...ctx.prefs, '*'])
  const { attributes, brand, shortDescription } = mapAttributes(projection, ctx)
  const categories = mapCategories(projection, ctx)

  return {
    sku,
    slug,
    name,
    ...(price ? { price } : {}),
    ...(prices.length > 0 ? { prices } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(shortDescription ? { shortDescription } : {}),
    ...(description ? { description } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...(brand ? { brand } : {}),
    ...(categories.length > 0 ? { categories } : {}),
    // A projection read with `staged=false` is published by definition.
    status: 'active',
  }
}

/** Minor units → major units. `fractionDigits` defaults to 2, as commercetools' does. */
export const toPrice = (money: CtTypedMoney): ProductPrice => ({
  amount: money.centAmount / 10 ** (money.fractionDigits ?? 2),
  currencyCode: money.currencyCode,
})

/**
 * The amount a shopper pays: the discounted value when a product discount
 * applies, else the price. The port has one price per currency, so showing
 * the undiscounted figure would quote a number nobody is charged.
 */
const effective = (price: CtPrice | undefined): ProductPrice | undefined =>
  price ? toPrice(price.discounted?.value ?? price.value) : undefined

/**
 * One price per currency from the variant's full set.
 *
 * commercetools can hold several prices per currency — scoped by country,
 * channel or customer group, and bounded by validity dates. Without a cart
 * there is no channel or customer group, so those are excluded; of what
 * remains, a price scoped to the requested country beats an unscoped one.
 * This is the fallback for when server-side selection returned nothing —
 * country-scoped prices are not selected unless `priceCountry` is sent.
 */
const mapPrices = (prices: readonly CtPrice[] | undefined, ctx: MappingContext): ProductPrice[] => {
  const live = (prices ?? []).filter(
    (p) =>
      !p.channel &&
      !p.customerGroup &&
      (!p.validFrom || Date.parse(p.validFrom) <= ctx.now) &&
      (!p.validUntil || Date.parse(p.validUntil) > ctx.now),
  )
  const rank = (p: CtPrice) => (ctx.country && p.country === ctx.country ? 0 : p.country ? 2 : 1)

  const byCurrency = new Map<string, CtPrice>()
  for (const p of [...live].sort((a, b) => rank(a) - rank(b))) {
    if (!byCurrency.has(p.value.currencyCode)) byCurrency.set(p.value.currencyCode, p)
  }
  return [...byCurrency.values()].map((p) => toPrice(p.discounted?.value ?? p.value))
}

/**
 * One image, or none when its URL is unusable. Imported data carries stray
 * whitespace (seen in the wild: a leading space that made next/image throw
 * and blank the whole listing), so URLs are trimmed and anything that still
 * isn't absolute http(s) is dropped rather than handed to the renderer.
 */
const mapImage = (image: CtImage): ProductImage[] => {
  const url = image.url.trim()
  if (!/^https?:\/\/\S+$/.test(url)) return []
  return [
    {
      url,
      ...(image.label ? { alt: image.label } : {}),
      ...(image.dimensions?.w ? { width: image.dimensions.w } : {}),
      ...(image.dimensions?.h ? { height: image.dimensions.h } : {}),
    },
  ]
}

/**
 * The product's categories plus every ancestor, deduplicated, in the order
 * commercetools lists them. commercetools recommends assigning parents
 * directly, but a project that didn't still gets correct ancestor browsing,
 * because each category carries its `ancestors` path.
 */
const mapCategories = (projection: CtProductProjection, ctx: MappingContext): string[] => {
  const ids: string[] = []
  for (const ref of projection.categories ?? []) {
    const category = ctx.categoriesById.get(ref.id)
    if (!category) continue
    for (const ancestor of category.ancestors ?? []) ids.push(ancestor.id)
    ids.push(category.id)
  }
  const identifiers = ids
    .map((id) => ctx.categoriesById.get(id))
    .filter((c): c is CtCategory => c !== undefined)
    .map((c) => categoryIdentifier(c, ctx.slugLocale))
  return [...new Set(identifiers)]
}

/**
 * Typed attributes → display rows, labelled from the product type.
 *
 * Only values with a sensible text form are kept: scalars, enums, localized
 * text, and sets of those. References, money and nested attributes are
 * skipped — they need dereferencing or a units model the port doesn't have.
 */
const mapAttributes = (
  projection: CtProductProjection,
  ctx: MappingContext,
): { attributes: ProductAttribute[]; brand?: string; shortDescription?: string } => {
  const definitions = ctx.productTypesById.get(projection.productType.id)?.attributes ?? []
  const labelFor = (name: string) =>
    pickLocalized(definitions.find((d) => d.name === name)?.label, [...ctx.prefs, '*']) ??
    humanise(name)

  const raw = projection.masterVariant.attributes ?? []
  const brandAttr = ctx.brandAttributes.find((n) => raw.some((a) => a.name === n))

  let brand: string | undefined
  let shortDescription: string | undefined
  const attributes: ProductAttribute[] = []
  for (const attribute of raw) {
    const value = displayValue(attribute.value, ctx.prefs)
    if (value === undefined || value === '') continue
    if (attribute.name === brandAttr) brand = value
    else if (attribute.name === ctx.shortDescriptionAttribute) shortDescription = value
    else attributes.push({ label: labelFor(attribute.name), value })
  }
  return {
    attributes,
    ...(brand ? { brand } : {}),
    ...(shortDescription ? { shortDescription } : {}),
  }
}

const displayValue = (value: unknown, prefs: readonly string[]): string | undefined => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => displayValue(v, prefs))
      .filter((v): v is string => v !== undefined && v !== '')
    return parts.length > 0 ? parts.join(', ') : undefined
  }
  if (isLocalizedString(value)) return pickLocalized(value, [...prefs, '*'])
  if (typeof value === 'object' && value !== null && 'key' in value) {
    // enum `{ key, label: "…" }` or lenum `{ key, label: { en: "…" } }`
    const { key, label } = value as { key: unknown; label?: unknown }
    if (typeof label === 'string') return label
    if (isLocalizedString(label)) return pickLocalized(label, [...prefs, '*'])
    return typeof key === 'string' ? key : undefined
  }
  return undefined
}

/** `colorFreeText` → `Color free text` — the fallback when a type has no label. */
const humanise = (name: string): string => {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Every SKU on a projection — master first — for resolving variant SKUs. */
export const skusOf = (projection: CtProductProjection): string[] =>
  [projection.masterVariant, ...(projection.variants ?? [])]
    .map((v) => v.sku)
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
