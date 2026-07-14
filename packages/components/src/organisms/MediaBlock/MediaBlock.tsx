import clsx from 'clsx'

import type { ContentMediaData } from '@amplience/quadratic-types'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { Link } from '../../atoms/Link/Link'
import { Typography } from '../../atoms/Typography/Typography'
import { ContentMedia } from '../../molecules/ContentMedia/ContentMedia'
import styles from './MediaBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaBlockColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'

export type MediaBlockBackgroundColor = MediaBlockColorToken

export type MediaBlockProps = {
  /**
   * Media to render. Accepts either a ManualImage (direct URL) or DynamicImage
   * (Amplience DAM asset via image-poi extension).
   */
  media: ContentMediaData
  /**
   * Optional caption rendered below the image in a <figcaption>.
   */
  caption?: string
  /**
   * Optional URL. When provided, the image is wrapped in a link.
   * External URLs open in a new tab; internal paths use Next.js routing.
   */
  href?: string
  /**
   * When true, the image extends edge-to-edge — the Container's horizontal
   * padding and max-width cap are both removed. Equivalent to setting
   * maxWidth="none" with the gutter removed.
   *
   * Vertical padding on the section is preserved.
   * Defaults to false.
   */
  fullBleed?: boolean
  /**
   * Background colour of the section, drawn from the design token palette.
   */
  backgroundColor?: MediaBlockBackgroundColor
  /**
   * Max-width constraint passed through to the inner Container atom.
   * Ignored when fullBleed is true.
   * Defaults to 'default'.
   */
  maxWidth?: ContainerProps['maxWidth']
  /**
   * When true, strips the outer `<section>` and `<Container>` wrapper and
   * renders only the `<figure>`. Use when MediaBlock is nested inside a layout
   * component (ColumnsBlock, GridBlock) that already provides container
   * semantics — avoids double-padding and misaligned max-width caps.
   * Defaults to false.
   */
  bare?: boolean
  /**
   * True when this block is the first block on the page (supplied by the
   * renderer via RenderContext, not authored). A top-of-page image is the
   * likely LCP element, so it renders with next/image `priority` — eager
   * load, `fetchpriority="high"`, and a head preload hint. Below the fold,
   * next/image's default lazy loading applies. Defaults to false.
   */
  isTopOfPage?: boolean
  /**
   * Active locale URL prefix (ADR-0015), supplied by the renderer. Keeps the
   * media link inside the current locale. Defaults to '' (default locale).
   */
  localeBasePath?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MediaBlock organism — a standalone media section on a page.
 *
 * Composes ContentMedia inside a semantic <figure> element, with optional:
 *   - caption  — <figcaption> below the image
 *   - href     — wraps media in a Link (internal or external)
 *   - fullBleed — image runs edge-to-edge (no Container padding)
 *
 * Supports both ManualImage (direct URL) and DynamicImage (Amplience DAM)
 * via the ContentMediaData discriminated union.
 *
 * All visual theming reads from --media-block-* CSS variables; brands
 * override under [data-brand] without touching this file.
 */
export function MediaBlock({
  media,
  caption,
  href,
  fullBleed,
  backgroundColor,
  maxWidth = 'default',
  bare = false,
  isTopOfPage = false,
  localeBasePath,
  className,
}: MediaBlockProps) {
  // Defaults before the spread: authored `image` props override. A full-bleed
  // image spans the viewport, so declaring sizes="100vw" lets next/image
  // preload the right candidate (with fetchpriority when priority is set)
  // rather than defaulting to the largest 3840px image.
  const mediaEl = (
    <ContentMedia
      priority={isTopOfPage}
      {...(isTopOfPage && { fetchPriority: 'high' })}
      {...(fullBleed && { sizes: '100vw' })}
      {...media}
      {...(styles.image !== undefined && { className: styles.image })}
    />
  )

  const figure = (
    <figure className={clsx(styles.figure, bare && className)}>
      {href ? (
        <Link
          href={href}
          className={clsx(styles.link)}
          {...(localeBasePath !== undefined && { localeBasePath })}
        >
          {mediaEl}
        </Link>
      ) : (
        mediaEl
      )}
      {caption && (
        <figcaption className={styles.caption}>
          <Typography variant="p">{caption}</Typography>
        </figcaption>
      )}
    </figure>
  )

  if (bare)
    return (
      <section
        className={clsx(styles.root, className)}
        data-full-bleed={fullBleed ? 'true' : undefined}
        data-background-color={backgroundColor}
      >
        {figure}
      </section>
    )

  return (
    <section
      aria-label={caption ? `Image: ${caption}` : 'Image'}
      className={clsx(styles.root, className)}
      data-full-bleed={fullBleed ? 'true' : undefined}
      data-background-color={backgroundColor}
    >
      <Container
        className={styles.container ?? ''}
        maxWidth={fullBleed ? 'none' : maxWidth}
        gutter={!fullBleed}
      >
        {figure}
      </Container>
    </section>
  )
}
