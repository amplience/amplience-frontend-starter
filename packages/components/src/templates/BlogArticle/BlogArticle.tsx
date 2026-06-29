import type { ReactNode } from 'react'

import { Container } from '../../atoms/Container/Container'
import { Icon } from '../../atoms/Icon/Icon'
import { Tags } from '../../molecules/Tags/Tags'
import { HeroBlock } from '../../organisms/HeroBlock/HeroBlock'
import styles from './BlogArticle.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlogArticleCoverImage = {
  readonly src: string
  readonly alt: string
  readonly width: number
  readonly height: number
}

export type BlogArticleProps = {
  /** Article headline. */
  readonly title?: string
  /** Cover image — shown above the header and on article cards. */
  readonly coverImage?: BlogArticleCoverImage
  /** Author display name. */
  readonly author?: string
  /** ISO 8601 date string, e.g. "2026-06-29". */
  readonly publishDate?: string
  /** Free-text category label. */
  readonly category?: string
  /** Topic tags. */
  readonly tags?: readonly string[]
  /** Estimated reading time in minutes. */
  readonly readTime?: number
  /** The article's rendered slots, in content order. */
  readonly children?: ReactNode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BlogArticle template — the rendered form of an Amplience blog-article
 * content item.
 *
 * Renders the cover image, headline, metadata bar (author, date, read time,
 * category, tags), then the slot-driven body blocks passed in as children.
 * Head metadata (`<title>`, Open Graph) is the route's responsibility — it
 * calls `blogArticleMetadataFromSchema` from `generateMetadata`, not this
 * component.
 */
export function BlogArticle({
  title,
  coverImage,
  author,
  publishDate,
  category,
  tags,
  readTime,
  children,
}: BlogArticleProps) {
  return (
    <article data-blog-article>
      <header data-blog-article-header className={styles.header}>
        <HeroBlock
          {...(coverImage !== undefined && { image: coverImage })}
          title={title ?? ''}
          subtitle={category ?? ''}
          heightBehaviour="fitToContent"
          contentPadding={100}
          overlayColor="black"
          overlayIntensity={50}
        />
        <section data-blog-article-meta className={styles.metaWrapper}>
          <Container gutter className={styles.container ?? ''}>
            <div className={styles.meta}>
              {author && (
                <span data-blog-author>
                  <Icon name="user" />
                  {author}
                </span>
              )}
              {publishDate && (
                <time data-blog-date dateTime={publishDate}>
                  <Icon name="calendar" />
                  {formatDate(publishDate)}
                </time>
              )}
              {readTime !== undefined && (
                <span data-blog-read-time>
                  <Icon name="clock" />
                  {readTime} min read
                </span>
              )}
            </div>
            {tags && tags.length > 0 && <Tags tags={tags} />}
          </Container>
        </section>
      </header>

      <main data-blog-article-body>{children}</main>
    </article>
  )
}
