/**
 * Blog archive route — `/blog` (QL-103).
 *
 * Lists all published blog-article items, sorted newest-first by
 * `publishDate`. Fetches via `listBySchema` (DC Filter API in production,
 * in-memory fixture filter in development) so no separate "BlogArchive"
 * content type is needed — the blog article schema *is* the catalogue.
 *
 * At POC scope (3 articles) pagination is out of scope; the full article
 * list fits on one page. The `generateStaticParams` call lives in
 * `/blog/[slug]` — this page itself is static by default (no dynamic
 * segments), so Next.js generates it at build time automatically.
 *
 * `BlogArticleCard` is a local component: it only ever renders here. If a
 * richer card design lands (image grid, featured article, etc.) it can be
 * promoted to `packages/components` at that point.
 */

import type { Metadata } from 'next'

import { Container } from '@amplience/quadratic-components/container'
import { GridBlock } from '@amplience/quadratic-components/grid-block'
import { MediaCard } from '@amplience/quadratic-components/media-card'
import { BLOG_ARTICLE_SCHEMA } from '@amplience/quadratic-components/registry'
import type { BlogArticleSchema } from '@amplience/quadratic-components/registry'

import { client } from '../../../lib/content-client'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Articles, guides, and updates from the Amplience team.',
}

// ---------------------------------------------------------------------------
// Local card component — only used on this page
// ---------------------------------------------------------------------------

type BlogArticleCardProps = {
  readonly article: BlogArticleSchema & { readonly _meta: unknown }
  readonly slug: string
}

function BlogArticleCard({ article, slug }: BlogArticleCardProps) {
  const href = `/blog/${slug}`

  /* If there's an author, prepend it to the description (separated with a bulletpoint character) */
  /* Same goes for the publish date, if present. */
  const cardContent = [
    article.author ? `By ${article.author}` : undefined,
    article.publishDate
      ? new Date(article.publishDate).toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined,
    article.readTime !== undefined ? `${article.readTime} min read` : undefined,
    article.description,
  ]
    .filter((s): s is string => s !== undefined)
    .join(' • ')

  return (
    <article data-blog-card>
      <MediaCard
        {...(article.coverImage !== undefined && { image: article.coverImage })}
        title={article.title ?? ''}
        {...(cardContent !== '' && { description: cardContent })}
        links={{ href }}
      />
    </article>
  )
}

// ---------------------------------------------------------------------------
// Archive page
// ---------------------------------------------------------------------------

/** Extract the first delivery key value from the standard `_meta` shape. */
const deliveryKeyFromMeta = (meta: unknown): string | undefined => {
  const m = meta as { deliveryKeys?: { values?: { value: string }[] } } | undefined
  return m?.deliveryKeys?.values?.[0]?.value
}

export default async function BlogArchivePage() {
  const all = await client.listBySchema<BlogArticleSchema>(BLOG_ARTICLE_SCHEMA)

  // Keep only items whose delivery key starts with `blog/` (guards against
  // any non-blog-route articles that might share the schema in future).
  const articles = all
    .flatMap((article) => {
      const key = deliveryKeyFromMeta((article as { _meta?: unknown })._meta)
      if (!key?.startsWith('blog/')) return []
      return [{ article: article, slug: key.slice('blog/'.length) }]
    })
    .sort((a, b) => {
      // Newest first; fall back to stable lexicographic order for ties.
      const dateA = a.article.publishDate ?? ''
      const dateB = b.article.publishDate ?? ''
      return dateB.localeCompare(dateA)
    })

  return (
    <main data-blog-archive>
      <header data-blog-archive-header>
        <Container gutter>
          <h1 data-blog-archive-title>Blog</h1>
        </Container>
      </header>
      {articles.length === 0 ? (
        <Container gutter>
          <p data-blog-archive-empty>No articles published yet.</p>
        </Container>
      ) : (
        <GridBlock
          gutter
          columnsMobile={1}
          columnsTablet={2}
          columnsDesktop={3}
          data-blog-archive-list
          backgroundColor="light"
        >
          {articles.map(({ article, slug }) => (
            <BlogArticleCard key={slug} article={article} slug={slug} data-blog-archive-item />
          ))}
        </GridBlock>
      )}
    </main>
  )
}
