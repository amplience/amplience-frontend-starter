import clsx from 'clsx'

import type { ContentMediaData, MediaLoadPriority } from '@amplience/frontend-starter-types'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { Link } from '../../atoms/Link/Link'
import { Typography } from '../../atoms/Typography/Typography'
import { ContentMedia } from '../../molecules/ContentMedia/ContentMedia'
import { mediaLoadingProps } from '../../molecules/ContentMedia/mediaLoadingProps'
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
   * How urgently this block's image should load, graded by how near the top of
   * the page it sits (supplied by the renderer via RenderContext, not
   * authored). A block on the page's leading edge is the likely LCP element and
   * arrives as `'lcp'`; one just below it as `'eager'`. Defaults to `'lazy'`.
   * See ADR-0021 and `mediaLoadingProps`.
   */
  loadPriority?: MediaLoadPriority
  /**
   * Active locale URL prefix (ADR-0015), supplied by the renderer. Keeps the
   * media link inside the current locale. Defaults to '' (default locale).
   */
  localeBasePath?: string
  /**
   * next/image `sizes` for the media, normally injected by a parent
   * GridBlock/ColumnsBlock from its column geometry (RenderContext.slotSizes).
   * A MediaBlock fills the full width of its slot, so the hint is used as-is
   * (no layout scaling). `fullBleed` overrides it to `100vw`. Defaults to
   * `100vw` — a standalone MediaBlock is a full-width section — which also
   * keeps next/image on width-based srcset rather than 1x/2x density
   * descriptors.
   */
  sizes?: string
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
  loadPriority = 'lazy',
  localeBasePath,
  sizes,
  className,
}: MediaBlockProps) {
  // A MediaBlock fills the width of its slot, so the parent's slot hint is used
  // directly. Full-bleed spans the viewport (100vw); absent any hint the block
  // is a full-width section, so 100vw is both correct and enough to keep
  // next/image on width-based srcset instead of 1x/2x density descriptors.
  const resolvedSizes = fullBleed ? '100vw' : (sizes ?? '100vw')
  const mediaEl = (
    <ContentMedia
      {...mediaLoadingProps(loadPriority)}
      sizes={resolvedSizes}
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
        className={clsx('MediaBlock', styles.root, className)}
        data-full-bleed={fullBleed ? 'true' : undefined}
        data-background-color={backgroundColor}
      >
        {figure}
      </section>
    )

  return (
    <section
      aria-label={caption ? `Image: ${caption}` : 'Image'}
      className={clsx('MediaBlock', styles.root, className)}
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
