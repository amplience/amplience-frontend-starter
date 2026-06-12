/**
 * The catch-all content route (QL-36, QL-37, QL-76).
 *
 * One route serves every content-addressed page: the optional catch-all
 * segment maps the URL path to a delivery key (`lib/routing.ts`) — `/` is
 * the homepage key, `/about` is `about` — and the item renders through the
 * renderer with this deployment's registry (ADR-0010). Dispatch, recursion,
 * and loud failure all live in `src/renderer`; composition lives in
 * `lib/registry.ts`. This file just connects them, which is what lets a
 * page added in the CMS go live with no route code at all.
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
 * When the SDK adapter lands (QL-43), the only change here is swapping
 * `makeMockContentClient` → `makeSdkContentClient` on the import line.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PAGE_SCHEMA, pageMetadataFromSchema } from '@amplience/quadratic-components/registry'
import type { PageSchema } from '@amplience/quadratic-components/registry'
import { isContentClientError } from '@amplience/quadratic-content'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

import { registry } from '../../lib/registry'
import { deliveryKeyForSlug, pathForDeliveryKey } from '../../lib/routing'
import { ContentUnavailableCard, emitContentFailure, renderContent } from '../../src/renderer'

const client = makeMockContentClient()

type RouteProps = {
  params: Promise<{ slug?: string[] }>
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

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params
  const key = deliveryKeyForSlug(slug)
  if (key === null) notFound()
  try {
    // depth: 'root' — metadata lives on the page item itself; no need to
    // resolve the slot tree just for the <head>.
    const page = await client.getByKey<PageSchema>(key, { depth: 'root' })
    // `path` feeds the self-referencing canonical default; it resolves
    // absolute against the layout's metadataBase (SITE_URL).
    const metadata = pageMetadataFromSchema(page, { path: pathForDeliveryKey(key) })
    // Component fragments stay out of the index regardless of what the
    // content sets — they're thin, navless duplicates of page content.
    if (!isPageItem(page)) return { ...metadata, robots: { index: false, follow: false } }
    return metadata
  } catch (error) {
    // The page body owns the visible failure surface — metadata just falls
    // back to the layout's site-wide defaults.
    if (isContentClientError(error)) return {}
    throw error
  }
}

export default async function ContentPage({ params }: RouteProps) {
  const { slug } = await params
  const key = deliveryKeyForSlug(slug)
  if (key === null) notFound()
  let page: unknown
  try {
    page = await client.getByKey(key, { depth: 'all' })
  } catch (error) {
    if (!isContentClientError(error)) throw error
    if (error.kind === 'not-found') notFound()
    emitContentFailure(error, key)
    return <ContentUnavailableCard error={error} resource={key} />
  }
  // The root of the tree is, by definition, the top of the page — the
  // dispatcher carries the flag along the leading edge from here so the
  // first block can load its imagery eagerly.
  return renderContent(page, registry, { isTopOfPage: true })
}
