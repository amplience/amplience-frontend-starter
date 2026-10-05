/**
 * The catch-all content route (QL-36, QL-37, QL-76; localized under ADR-0015).
 *
 * One route serves every content-addressed page: the optional catch-all
 * segment maps the URL path to a delivery key (`lib/routing.ts`) — `/` is
 * the homepage key, `/about` is `about` — and the item renders through the
 * renderer with this deployment's registry (ADR-0010). Dispatch, recursion,
 * and loud failure all live in `src/renderer`; composition lives in
 * `lib/registry.ts`. This file just connects them, which is what lets a
 * page added in the CMS go live with no route code at all.
 *
 * The `[locale]` segment (ADR-0015) carries the active locale: the middleware
 * populates it (unprefixed URLs are rewritten to the default locale), the
 * route resolves it to a Delivery API locale, and the content client collapses
 * localized fields to that locale before the renderer sees them — so
 * components only ever receive single-value fields. The default locale is
 * unprefixed, so its canonical URL stays clean; other locales carry their
 * slug (`/fr-fr/about`) in both the URL and the self-referencing canonical.
 *
 * The same v1 idea (`src/pages/[[...slug]].tsx`) rebuilt on App Router
 * conventions: `params` is async, fetching is in-component, and metadata
 * comes from `generateMetadata` reading the same page item via
 * `pageMetadataFromSchema`. The route path feeds the self-referencing
 * canonical default; items reachable by several delivery keys point all of
 * them at one path by setting `canonicalUrl` in content. Non-page items
 * (any keyed component or slot) render too — useful for eyeballing one
 * component in isolation — but always carry `noindex`, so fragment URLs
 * never compete with real pages in a search index.
 *
 * Failure stays loud, not blank (QL-37): reserved keys (site furniture)
 * and unknown keys are a branded 404 (`notFound()` → app/not-found.tsx);
 * any other `ContentClientError` renders the ContentUnavailable card in
 * place of the tree — server-rendered, like every other failure surface.
 * Only genuinely unexpected errors fall through to app/error.tsx.
 *
 * Since ADR-0024 an unknown key is not immediately a 404: the path may name
 * a product category, which is resolved from `ProductSource.listCategories()`
 * and rendered as a listing. The order — CMS page, then category, then 404 —
 * is what lets an editor override any category's listing with a designed
 * landing page simply by publishing a page at that key. That works at every
 * level, because identifiers are opaque and there is no notion of level.
 *
 * ⚠️ The fall-through happens **only** on `kind === 'not-found'`. Every other
 * `ContentClientError` stops at the ContentUnavailable card. Letting a
 * transient CMS failure reach the 404 would turn a brief outage into a wall
 * of 404s — and a 404 asserts *will never exist*, so crawlers deindex and
 * CDNs cache it long after the hub comes back.
 *
 * Which client serves the content is environment-driven composition
 * (QL-43): `lib/content-client.ts` resolves mock vs SDK once, and this
 * route just consumes the port.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Container } from '@amplience/frontend-starter-components/container'
import {
  PAGE_SCHEMA,
  pageMetadataFromSchema,
} from '@amplience/frontend-starter-components/registry'
import type { PageSchema } from '@amplience/frontend-starter-components/registry'
import { isContentClientError } from '@amplience/frontend-starter-content'

import { categoryIdForSlug, categoryTitle } from '../../../../lib/categories'
import { client, siteName } from '../../../../lib/content-client'
import { resolveCurrency } from '../../../../lib/currency'
import { localeBasePath, localeForSlug, publicPath } from '../../../../lib/locales'
import type { Locale } from '../../../../lib/locales'
import { productSource } from '../../../../lib/product-source'
import { registry } from '../../../../lib/registry'
import { deliveryKeyForSlug, pathForDeliveryKey } from '../../../../lib/routing'
import { ProductGrid } from '../../../../src/ProductGrid'
import { ContentUnavailableCard, emitContentFailure, renderContent } from '../../../../src/renderer'

type RouteProps = {
  params: Promise<{ locale: string; slug?: string[] }>
}

/**
 * Whether a fetched item is a page, read off its `_meta.schema`. Every
 * keyed item is URL-addressable (a keyed hero renders at `/about/hero`),
 * which is handy for eyeballing a single component — but only pages belong
 * in a search index, so non-pages always get `noindex` below.
 */
const isPageItem = (item: PageSchema): boolean => {
  const meta = item._meta as { schema?: unknown } | undefined
  return meta?.schema === PAGE_SCHEMA
}

/**
 * Whether this path names a category, asked of the port (ADR-0024).
 *
 * The CMS is never consulted: it holds no category list, which is what keeps
 * this admissible under ADR-0018 Decision §8. Matching is equality against
 * the derived set — never a pattern over the URL.
 *
 * `generateMetadata` and the page body both ask, so the *set* is memoised for
 * the request — otherwise a category page reads the whole catalogue twice to
 * answer the same question. The memo is on the zero-argument set getter, not
 * on this function: `cache()` keys on argument identity, and `params` hands
 * out a fresh `slug` array to each caller, so keying on it would never hit.
 */
const categorySet = cache(async (): Promise<readonly string[]> => {
  try {
    return await productSource.listCategories()
  } catch (error) {
    // One invariant across this whole route: `not-found` is the only kind
    // that ever advances or degrades. From a *list* it means "nothing
    // matched", never "the service is broken", so it reads as an empty set.
    // Every other kind is a real failure and belongs to the caller's card.
    if (isContentClientError(error) && error.kind === 'not-found') return []
    throw error
  }
})

const categoryForSlug = async (slug: readonly string[] | undefined): Promise<string | null> => {
  const id = categoryIdForSlug(slug)
  if (id === null) return null
  return (await categorySet()).includes(id) ? id : null
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: localeSlug, slug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()
  const key = deliveryKeyForSlug(siteName, slug)
  if (key === null) notFound()
  try {
    // depth: 'root' — metadata lives on the page item itself; no need to
    // resolve the slot tree just for the <head>.
    const page = await client.getByKey<PageSchema>(key, { depth: 'root', locale: locale.delivery })
    // `path` feeds the self-referencing canonical default; it resolves
    // absolute against the layout's metadataBase (SITE_URL). The locale
    // prefix is folded in here so a localized page canonicalizes to itself
    // (the default locale stays unprefixed).
    const metadata = pageMetadataFromSchema(page, {
      path: publicPath(locale, pathForDeliveryKey(siteName, key)),
    })
    // Component fragments stay out of the index regardless of what the
    // content sets — they're thin, navless duplicates of page content.
    if (!isPageItem(page)) return { ...metadata, robots: { index: false, follow: false } }
    return metadata
  } catch (error) {
    // The page body owns the visible failure surface — metadata just falls
    // back to the layout's site-wide defaults.
    if (!isContentClientError(error)) throw error
    // Same waterfall as the body, and for the same reason: a category page
    // with no override should still get a title rather than the site default.
    // Only 'not-found' continues — a hub outage must not be answered with a
    // confident category title for a category we never looked up.
    if (error.kind !== 'not-found') return {}
    // Metadata never owns a failure surface — the body does — so a category
    // lookup that fails here falls back to the layout defaults rather than
    // throwing a second time.
    const category = await categoryForSlug(slug).catch(() => null)
    if (category === null) return {}
    return {
      title: categoryTitle(category),
      alternates: { canonical: publicPath(locale, `/${category}`) },
    }
  }
}

export default async function ContentPage({ params }: RouteProps) {
  const { locale: localeSlug, slug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()
  const key = deliveryKeyForSlug(siteName, slug)
  if (key === null) notFound()
  let page: unknown
  try {
    page = await client.getByKey(key, { depth: 'all', locale: locale.delivery })
  } catch (error) {
    if (!isContentClientError(error)) throw error
    // ⚠️ Only a genuine miss continues to the category branch. Any other
    // failure stops here — see the module docblock on why a transient error
    // must never become a 404.
    if (error.kind !== 'not-found') {
      emitContentFailure(error, key)
      return <ContentUnavailableCard error={error} resource={key} />
    }
    let category: string | null
    try {
      category = await categoryForSlug(slug)
    } catch (categoryError) {
      // The page was genuinely absent, but the category set couldn't be read.
      // That is not knowledge that the URL will never exist, so it must not
      // become a 404.
      if (!isContentClientError(categoryError)) throw categoryError
      emitContentFailure(categoryError, key)
      return <ContentUnavailableCard error={categoryError} resource={key} />
    }
    if (category === null) notFound()
    return await renderCategoryListing(category, locale)
  }
  // The root of the tree is, by definition, the top of the page, so it starts at
  // the most urgent tier and the dispatcher demotes it with distance from here:
  // the first block is treated as the LCP candidate, the second as
  // above-the-fold-but-not-LCP, everything after as lazy (ADR-0021).
  // `localeBasePath` rides the whole tree so internal links stay inside this
  // locale (ADR-0015).
  return renderContent(page, registry, {
    loadPriority: 'lcp',
    localeBasePath: localeBasePath(locale),
  })
}

/**
 * A category's product listing — the fallback when no page overrides it
 * (ADR-0024).
 *
 * `list({ category })` filters by exact membership, and ancestors are
 * denormalised onto each product, so `/mens` returns everything in
 * `mens-shirts` and `mens-jackets` without anyone holding a tree.
 *
 * The title is derived from the identifier and is therefore unlocalised
 * (ADR-0024 §9). That is the accepted cost of having no category content
 * type; the fix for any category that deserves better is an override page,
 * which is fully authored and fully localised.
 *
 * An awaited function rather than an async component, so the route returns
 * resolved elements on every path — the same contract the page branch has.
 * Returning `<CategoryListing />` would hand back an unresolved async element
 * that only a streaming renderer can finish, which the rest of this file
 * never does. When ADR-0022 moves this route to the sync-shell-plus-Suspense
 * shape, the whole file changes together.
 */
async function renderCategoryListing(category: string, locale: Locale) {
  const { products } = await productSource.list({
    category,
    locale: locale.delivery,
    currency: resolveCurrency(locale.code),
  })

  const title = categoryTitle(category)

  return (
    <main data-category-listing data-category={category}>
      <header data-category-listing-header>
        <Container gutter>
          <h1>{title}</h1>
        </Container>
      </header>

      <ProductGrid products={products} locale={locale} emptyMessage={`Nothing in ${title} yet.`} />
    </main>
  )
}
