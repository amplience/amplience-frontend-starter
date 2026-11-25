/**
 * Story data for the product components, read from the real content fixtures.
 *
 * A representative slice of the products `packages/content/fixtures/anyafinn/
 * pages/products/` seeds into a hub — real commercetools data, so a story shows
 * what the CMS actually holds: a four-shot gallery, single packshots, a sale
 * price, a name long enough to stress a card, and a product with editorial
 * slots. The catalogue has no sparse or discontinued products, so the stories
 * for those states override a real product's fields rather than inventing one.
 *
 * The delivery bodies are localized (`{ values: [...] }`) because that is what
 * the Delivery API returns when no locale is requested — the content client
 * collapses them at read time, and `text()` below does the same job for a
 * story, which has no client.
 *
 * Story/Storybook use only. Nothing here is imported by a component, and the
 * relative path out of `src` is deliberate: it keeps `packages/components`
 * free of a dependency on `packages/content`, which would defeat the port.
 */

import type { ContentMediaData, ResolvedProduct } from '@amplience/frontend-starter-types'

import christmasTree from '../../../content/fixtures/anyafinn/pages/products/anyafinn-2ft-pre-lit-flocked-christmas-tree-with-burlap-base.json'
import argyleCardigan from '../../../content/fixtures/anyafinn/pages/products/anyafinn-collared-argyle-cardigan-pink-burgundy.json'
import embossedFloorLamp from '../../../content/fixtures/anyafinn/pages/products/anyafinn-embossed-floor-lamp.json'
import suedeTrenchCoat from '../../../content/fixtures/anyafinn/pages/products/anyafinn-suede-trench-coat-khaki.json'
import tailoredOvercoat from '../../../content/fixtures/anyafinn/pages/products/anyafinn-tailored-overcoat-brown.json'
import terraCoffeeTable from '../../../content/fixtures/anyafinn/pages/products/anyafinn-terra-stone-effect-coffee-table.json'
import funnelNeckJacket from '../../../content/fixtures/anyafinn/pages/products/anyafinn-water-resistant-funnel-neck-jacket-light-beige.json'

/** The presentational shape the product components take. */
export type StoryProduct = {
  readonly sku: string
  readonly slug: string
  readonly href: string
  readonly name: string
  readonly shortDescription?: string
  readonly price?: { readonly amount: number; readonly currencyCode: string }
  readonly prices: readonly { readonly amount: number; readonly currencyCode: string }[]
  readonly images: readonly ContentMediaData[]
  readonly attributes: readonly { label: string; value: string }[]
  readonly brand?: string
  readonly categories: readonly string[]
  readonly tags: readonly string[]
  readonly status?: 'active' | 'coming-soon' | 'discontinued'
}

const DEFAULT_LOCALE = 'en-GB'

/**
 * Collapse a localized field to one locale — what `resolveLocalized` does at
 * read time. Falls back to the first authored value, matching the `*`
 * wildcard the content client uses when no preference is given.
 */
const text = (field: unknown, locale: string = DEFAULT_LOCALE): string | undefined => {
  if (typeof field === 'string') return field
  const values = (field as { values?: { locale: string; value: unknown }[] } | undefined)?.values
  if (!Array.isArray(values)) return undefined
  const match = values.find((v) => v.locale === locale) ?? values[0]
  return typeof match?.value === 'string' ? match.value : undefined
}

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

const STATUSES = ['active', 'coming-soon', 'discontinued'] as const

/** Narrows rather than casts, so a typo in a fixture drops the field instead of faking it. */
const isStatus = (v: unknown): v is NonNullable<StoryProduct['status']> =>
  STATUSES.some((s) => s === v)

/**
 * Normalise one fixture body. Typed through `unknown` rather than the JSON's
 * inferred shape because the files differ — only some carry `slots` or a
 * sale price — so a shared literal type would have to be their union.
 */
const toStoryProduct = (
  fixture: unknown,
  locale: string = DEFAULT_LOCALE,
  currency?: string,
): StoryProduct => {
  const body = (fixture as { body: Record<string, unknown> }).body
  const key = (body._meta as { deliveryKeys?: { values?: { value: string }[] } } | undefined)
    ?.deliveryKeys?.values?.[0]?.value
  const slug = key?.split('/').pop() ?? ''

  // Content holds one price per currency; a story shows one of them. Which
  // one is a deployment policy (`resolveCurrency` in apps/web), so a story
  // just takes the first — or the requested one, for the localized stories.
  const prices = Array.isArray(body.prices)
    ? body.prices.flatMap((entry) => {
        const p = entry as { amount?: unknown; currencyCode?: unknown }
        const amount = num(p.amount)
        return typeof p.currencyCode === 'string' && amount !== undefined
          ? [{ amount, currencyCode: p.currencyCode }]
          : []
      })
    : []
  const selected =
    currency === undefined ? prices[0] : prices.find((p) => p.currencyCode === currency)

  const attributes = Array.isArray(body.attributes)
    ? body.attributes.flatMap((a) => {
        const label = text((a as { label?: unknown }).label, locale)
        const value = text((a as { value?: unknown }).value, locale)
        return label !== undefined && value !== undefined ? [{ label, value }] : []
      })
    : []

  const shortDescription = text(body.shortDescription, locale)
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string')
    : []

  return {
    sku: typeof body.sku === 'string' ? body.sku : slug.toUpperCase(),
    slug,
    href: `/products/${slug}`,
    name: text(body.name, locale) ?? slug,
    ...(shortDescription !== undefined && { shortDescription }),
    ...(selected !== undefined && { price: selected }),
    prices,
    // The media partial's delivery shape is exactly `ContentMediaData`; the
    // cast is only because a JSON import widens `mediaType` to `string`.
    images: Array.isArray(body.images) ? (body.images as ContentMediaData[]) : [],
    attributes,
    ...(typeof body.brand === 'string' && { brand: body.brand }),
    categories: Array.isArray(body.categories)
      ? body.categories.filter((c): c is string => typeof c === 'string')
      : [],
    tags,
    ...(isStatus(body.status) && { status: body.status }),
  }
}

/** The story products, in catalogue (name) order. */
export const storyProducts: readonly StoryProduct[] = [
  argyleCardigan,
  christmasTree,
  embossedFloorLamp,
  funnelNeckJacket,
  suedeTrenchCoat,
  tailoredOvercoat,
  terraCoffeeTable,
]
  .map((f) => toStoryProduct(f))
  .sort((a, b) => a.name.localeCompare(b.name))

/** One fixture product by slug. Throws loudly rather than rendering an empty story. */
export const storyProduct = (slug: string): StoryProduct => {
  const found = storyProducts.find((p) => p.slug === slug)
  if (!found) throw new Error(`No product fixture with slug "${slug}"`)
  return found
}

/** The same product in a different locale, for the localization stories. */
export const storyProductIn = (slug: string, locale: string, currency?: string): StoryProduct => {
  const source = [
    argyleCardigan,
    christmasTree,
    embossedFloorLamp,
    funnelNeckJacket,
    suedeTrenchCoat,
    tailoredOvercoat,
    terraCoffeeTable,
  ].find((f) => toStoryProduct(f).slug === slug)
  if (source === undefined) throw new Error(`No product fixture with slug "${slug}"`)
  return toStoryProduct(source, locale, currency)
}

/**
 * The fixture products as `ResolvedProduct`s — the same mapping the
 * composition boundary does from the port's normalised `Product` (ADR-0027),
 * for the components that take resolved products (carousels, listings).
 */
export const storyResolvedProducts: readonly ResolvedProduct[] = storyProducts.map((p) => ({
  sku: p.sku,
  slug: p.slug,
  name: p.name,
  href: p.href,
  ...(p.price !== undefined && { price: p.price }),
  ...(p.images[0] !== undefined && { media: p.images[0] }),
  ...(p.brand !== undefined && { brand: p.brand }),
  ...(p.shortDescription !== undefined && { shortDescription: p.shortDescription }),
  ...(p.status !== undefined && { status: p.status }),
}))
