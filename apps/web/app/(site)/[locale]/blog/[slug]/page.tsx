/**
 * Blog article route — `/blog/[slug]` (QL-104; localized under ADR-0015).
 *
 * Fetches one blog-article content item by its delivery key (`blog/<slug>`)
 * and renders it through the same registry-driven renderer as the generic
 * catch-all. `BlogArticle` is a container entry: the renderer recurses into
 * its slots, so the article body composes freely from any registered block.
 *
 * The `[locale]` segment carries the active locale (ADR-0015): the article is
 * fetched at that locale so its fields arrive as single values, and the
 * canonical folds the locale prefix in (unprefixed for the default locale).
 * No `generateStaticParams`, for the same reason as the product page: under
 * the `(site)` 404 boundary (which reads `headers()`), a statically-generated
 * route 500s on any slug not built ahead of time — every slug, when the build
 * saw no articles.
 *
 * Failure handling mirrors the catch-all:
 *  - `not-found` → branded 404 (app/not-found.tsx)
 *  - other `ContentClientError` → `ContentUnavailableCard` in-page
 *  - unexpected errors → rethrown to app/error.tsx
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { blogArticleMetadataFromSchema } from '@amplience/frontend-starter-components/registry'
import type { BlogArticleSchema } from '@amplience/frontend-starter-components/registry'
import { isContentClientError } from '@amplience/frontend-starter-content'

import { client, siteName } from '../../../../../lib/content-client'
import { localeBasePath, localeForSlug, publicPath } from '../../../../../lib/locales'
import { registry } from '../../../../../lib/registry'
import {
  ContentUnavailableCard,
  emitContentFailure,
  renderContent,
} from '../../../../../src/renderer'

type RouteProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: localeSlug, slug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()
  const key = `${siteName}/blog/${slug}`
  try {
    const article = await client.getByKey<BlogArticleSchema>(key, {
      depth: 'root',
      locale: locale.delivery,
    })
    // The canonical path is the URL, not the key — the site prefix never
    // surfaces in public URLs (ADR-0014); the locale prefix does, except for
    // the default locale (ADR-0015).
    return blogArticleMetadataFromSchema(article, { path: publicPath(locale, `/blog/${slug}`) })
  } catch (error) {
    if (isContentClientError(error)) return {}
    throw error
  }
}

export default async function BlogArticlePage({ params }: RouteProps) {
  const { locale: localeSlug, slug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()
  const key = `${siteName}/blog/${slug}`
  let article: unknown
  try {
    article = await client.getByKey(key, { depth: 'all', locale: locale.delivery })
  } catch (error) {
    if (!isContentClientError(error)) throw error
    if (error.kind === 'not-found') notFound()
    emitContentFailure(error, key)
    return <ContentUnavailableCard error={error} resource={key} />
  }
  return renderContent(article, registry, {
    loadPriority: 'lcp',
    localeBasePath: localeBasePath(locale),
  })
}
