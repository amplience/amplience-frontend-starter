/**
 * Blog archive route — `/blog` (QL-103; localized under ADR-0015).
 *
 * Lists this site's published blog-article items, sorted newest-first by
 * `publishDate`, one card per slug. Fetches via `listBySchema` (DC Filter API
 * in production, in-memory fixture filter in development) so no separate
 * "BlogArchive" content type is needed — the blog article schema *is* the
 * catalogue. Turning that read into the archive is `lib/blog-archive`, shared
 * with `/blog/[slug]` so the links here and the prerendered routes there are
 * derived from one function.
 *
 * The `[locale]` segment carries the active locale: cards fetch at that
 * locale so titles and descriptions arrive as single values, and card links
 * keep the locale in the path (`/fr-fr/blog/<slug>`) so navigation stays
 * within the reader's language. The default locale is unprefixed.
 *
 * At POC scope (3 articles) pagination is out of scope; the full article
 * list fits on one page. The `generateStaticParams` call lives in
 * `/blog/[slug]` — this page itself has no dynamic segment of its own, so
 * Next.js generates it per locale automatically.
 *
 * `BlogArticleCard` is a local component: it only ever renders here. If a
 * richer card design lands (image grid, featured article, etc.) it can be
 * promoted to `packages/components` at that point.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Container } from '@amplience/quadratic-components/container'
import { GridBlock } from '@amplience/quadratic-components/grid-block'
import { HeroBlock } from '@amplience/quadratic-components/hero-block'
import { MediaCard } from '@amplience/quadratic-components/media-card'
import { BLOG_ARTICLE_SCHEMA } from '@amplience/quadratic-components/registry'
import type { BlogArticleSchema } from '@amplience/quadratic-components/registry'

import { blogArchiveFromItems, warnOnDuplicateSlugs } from '../../../../lib/blog-archive'
import { client, siteName } from '../../../../lib/content-client'
import { localeForSlug, publicPath } from '../../../../lib/locales'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Articles, guides, and updates from the Amplience team.',
}

type RouteProps = {
  params: Promise<{ locale: string }>
}

// ---------------------------------------------------------------------------
// Local card component — only used on this page
// ---------------------------------------------------------------------------

type BlogArticleCardProps = {
  readonly article: BlogArticleSchema & { readonly _meta: unknown }
  readonly href: string
}

function BlogArticleCard({ article, href }: BlogArticleCardProps) {
  /* If there's an author, prepend it to the description (separated with a bullet point character) */
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
      {/* media (not `image`) — the previous `image` prop name silently
          matched nothing on MediaCard, so archive cards rendered without images. */}
      <MediaCard
        {...(article.coverImage !== undefined && { media: article.coverImage })}
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

export default async function BlogArchivePage({ params }: RouteProps) {
  const { locale: localeSlug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()

  const all = await client.listBySchema<BlogArticleSchema>(BLOG_ARTICLE_SCHEMA, {
    locale: locale.delivery,
  })

  // Site scoping (ADR-0014), newest-first ordering and one-entry-per-slug all
  // live in `blogArchiveFromItems`, shared with `/blog/[slug]`.
  const { entries: articles, duplicateSlugs } = blogArchiveFromItems(all, siteName)
  warnOnDuplicateSlugs(duplicateSlugs)

  return (
    <main data-blog-archive>
      <header data-blog-archive-header>
        <HeroBlock
          title="Blog"
          description="Articles, guides, and updates from the Amplience team."
          backgroundColor="black"
          contentPadding={30}
        />
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
            <BlogArticleCard
              key={slug}
              article={article}
              href={publicPath(locale, `/blog/${slug}`)}
              data-blog-archive-item
            />
          ))}
        </GridBlock>
      )}
    </main>
  )
}
