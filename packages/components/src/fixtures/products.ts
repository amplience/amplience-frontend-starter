/**
 * Story data for the product components, read from the real content fixtures.
 *
 * These are the same seven items `packages/content/fixtures/base-site/pages/
 * products/` seeds into a hub, so a story shows what the CMS actually holds —
 * including the awkward ones. `aurora-shelving` has no image and no price;
 * `mara-hand-woven-wool-throw` has a name long enough to break a card;
 * `verde-ceramic-planter` is discontinued. Hand-written story data drifts from
 * the fixtures and quietly stops covering those cases.
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

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import auroraLoungeChair from '../../../content/fixtures/base-site/pages/products/aurora-lounge-chair.json'
import auroraShelving from '../../../content/fixtures/base-site/pages/products/aurora-shelving.json'
import auroraSideTable from '../../../content/fixtures/base-site/pages/products/aurora-side-table.json'
import lumenFloorLamp from '../../../content/fixtures/base-site/pages/products/lumen-floor-lamp.json'
import maraWoolThrow from '../../../content/fixtures/base-site/pages/products/mara-hand-woven-wool-throw.json'
import terraDiningTable from '../../../content/fixtures/base-site/pages/products/terra-dining-table.json'
import verdePlanter from '../../../content/fixtures/base-site/pages/products/verde-ceramic-planter.json'

/** The presentational shape the product components take. */
export type StoryProduct = {
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
 * inferred shape because the seven files differ — `aurora-shelving` carries no
 * `images`, `price` or `attributes` at all, so a shared literal type would
 * have to be the union of all seven.
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

/** All seven fixture products, in catalogue (name) order. */
export const storyProducts: readonly StoryProduct[] = [
  auroraLoungeChair,
  auroraShelving,
  auroraSideTable,
  lumenFloorLamp,
  maraWoolThrow,
  terraDiningTable,
  verdePlanter,
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
    auroraLoungeChair,
    auroraShelving,
    auroraSideTable,
    lumenFloorLamp,
    maraWoolThrow,
    terraDiningTable,
    verdePlanter,
  ].find((f) => toStoryProduct(f).slug === slug)
  if (source === undefined) throw new Error(`No product fixture with slug "${slug}"`)
  return toStoryProduct(source, locale, currency)
}
