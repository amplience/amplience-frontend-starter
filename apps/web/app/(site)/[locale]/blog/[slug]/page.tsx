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
 * `generateStaticParams` enumerates the cross-product of supported locales
 * and published articles — the delivery keys themselves are not localized, so
 * one `listBySchema` call yields the slug set, expanded across locales here.
 *
 * Failure handling mirrors the catch-all:
 *  - `not-found` → branded 404 (app/not-found.tsx)
 *  - other `ContentClientError` → `ContentUnavailableCard` in-page
 *  - unexpected errors → rethrown to app/error.tsx
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import {
  BLOG_ARTICLE_SCHEMA,
  blogArticleMetadataFromSchema,
} from '@amplience/frontend-starter-components/registry'
import type { BlogArticleSchema } from '@amplience/frontend-starter-components/registry'
import { isContentClientError } from '@amplience/frontend-starter-content'

import { blogArchiveFromItems } from '../../../../../lib/blog-archive'
import { client, siteName } from '../../../../../lib/content-client'
import { localeBasePath, localeForSlug, locales, publicPath } from '../../../../../lib/locales'
import { registry } from '../../../../../lib/registry'
import {
  ContentUnavailableCard,
  emitContentFailure,
  renderContent,
} from '../../../../../src/renderer'

type RouteProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
  // Enumerate only this site's articles (ADR-0014) — the schema is shared
  // hub-wide, the `<site>/blog/` namespace is not. `blogArchiveFromItems` does
  // that scoping, and yields one entry per slug: a slug is a route, so a
  // duplicate published claim on one must not become a duplicate param. The
  // archive page derives its links from the same call. Delivery keys aren't
  // localized, so one fetch yields the slug set; the cross-product with the
  // supported locales prerenders every article in every language.
  const articles = await client.listBySchema(BLOG_ARTICLE_SCHEMA)
  const { entries } = blogArchiveFromItems(articles, siteName)
  return locales.flatMap((locale) => entries.map(({ slug }) => ({ locale: locale.slug, slug })))
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
