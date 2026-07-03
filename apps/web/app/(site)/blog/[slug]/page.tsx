/**
 * Blog article route — `/blog/[slug]` (QL-104).
 *
 * Fetches one blog-article content item by its delivery key (`blog/<slug>`)
 * and renders it through the same registry-driven renderer as the generic
 * catch-all. `BlogArticle` is a container entry: the renderer recurses into
 * its slots, so the article body composes freely from any registered block.
 *
 * `generateStaticParams` enumerates all published blog-article items via
 * `listBySchema` — the same call the archive page makes — so the blog is
 * fully statically generated at build time with no runtime fetch overhead.
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
} from '@amplience/quadratic-components/registry'
import type { BlogArticleSchema } from '@amplience/quadratic-components/registry'
import { isContentClientError } from '@amplience/quadratic-content'

import { client, siteName } from '../../../../lib/content-client'
import { registry } from '../../../../lib/registry'
import { ContentUnavailableCard, emitContentFailure, renderContent } from '../../../../src/renderer'

type RouteProps = {
  params: Promise<{ slug: string }>
}

/** Extract the first delivery key value from the standard `_meta` shape. */
const deliveryKeyFromMeta = (meta: unknown): string | undefined => {
  const m = meta as { deliveryKeys?: { values?: { value: string }[] } } | undefined
  return m?.deliveryKeys?.values?.[0]?.value
}

export async function generateStaticParams() {
  // Enumerate only this site's articles (ADR-0014) — the schema is shared
  // hub-wide, the `<site>/blog/` namespace is not.
  const blogPrefix = `${siteName}/blog/`
  const articles = await client.listBySchema(BLOG_ARTICLE_SCHEMA)
  return articles.flatMap((article) => {
    const key = deliveryKeyFromMeta((article as { _meta?: unknown })._meta)
    if (!key?.startsWith(blogPrefix)) return []
    return [{ slug: key.slice(blogPrefix.length) }]
  })
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params
  const key = `${siteName}/blog/${slug}`
  try {
    const article = await client.getByKey<BlogArticleSchema>(key, { depth: 'root' })
    // The canonical path is the URL, not the key — the site prefix never
    // surfaces in public URLs (ADR-0014).
    return blogArticleMetadataFromSchema(article, { path: `/blog/${slug}` })
  } catch (error) {
    if (isContentClientError(error)) return {}
    throw error
  }
}

export default async function BlogArticlePage({ params }: RouteProps) {
  const { slug } = await params
  const key = `${siteName}/blog/${slug}`
  let article: unknown
  try {
    article = await client.getByKey(key, { depth: 'all' })
  } catch (error) {
    if (!isContentClientError(error)) throw error
    if (error.kind === 'not-found') notFound()
    emitContentFailure(error, key)
    return <ContentUnavailableCard error={error} resource={key} />
  }
  return renderContent(article, registry, { isTopOfPage: true })
}
