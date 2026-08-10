import clsx from 'clsx'

import type { ContentMediaData, MediaLoadPriority } from '@amplience/quadratic-types'

import { Button } from '../../atoms/Button/Button'
import type { ButtonColor, ButtonVariant } from '../../atoms/Button/Button'
import { Card } from '../../atoms/Card/Card'
import type { CardColor, CardElevation } from '../../atoms/Card/Card'
import { Link } from '../../atoms/Link/Link'
import { Typography } from '../../atoms/Typography/Typography'
import { scaleSizes } from '../../utils/imageSizes'
import { ContentMedia } from '../ContentMedia/ContentMedia'
import { mediaLoadingProps } from '../ContentMedia/mediaLoadingProps'
import styles from './MediaCard.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Controls how the image and body are arranged inside the card.
 *
 *   above   — image stacked above the text body (default)
 *   beside  — image left, body right in a fixed split
 *   dynamic — above when the card is narrow, beside when wide.
 *             Uses a container query so the switch is driven by the
 *             card's own rendered width, not the viewport.
 *   overlay — image fills the card; body is layered on top with a
 *             gradient scrim. Uses CSS grid named areas so both slots
 *             occupy the same cell without absolute positioning.
 */
export type MediaCardLayout = 'above' | 'beside' | 'dynamic' | 'overlay'

export type MediaCardCtaProps = {
  label: string
  href: string
  variant?: ButtonVariant
  color?: ButtonColor
}

export type MediaCardLinks = {
  /**
   * Makes the entire card a single link. When set, `cta` is ignored —
   * avoid nesting interactive elements inside an already-interactive card.
   * External URLs open in a new tab; internal paths use Next.js routing.
   */
  href?: string
  /**
   * Explicit call-to-action rendered inside the body. Only used when `href`
   * is not set. Use `href` when you want the whole card to be clickable.
   */
  cta?: MediaCardCtaProps
}

export type MediaCardProps = {
  /** Card heading. Rendered as an h3 by default; override via headingVariant. */
  title: string
  /** Optional body copy below the title. */
  description?: string
  /**
   * Cover media. Renders flush with the card edge (no Card padding).
   * Accepts ManualImage (direct URL) or DynamicImage (Amplience DAM asset).
   */
  media?: ContentMediaData
  /** Card-level link and CTA — see MediaCardLinks. */
  links?: MediaCardLinks
  /**
   * Image/body arrangement — see MediaCardLayout.
   * Defaults to 'above'.
   */
  layout?: MediaCardLayout
  /**
   * Heading element rendered for the card title.
   * Defaults to 'h3' — adjust to fit the surrounding document outline.
   */
  headingVariant?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  /** Card surface elevation. Passed through to the Card atom. Defaults to 'raised'. */
  elevation?: CardElevation
  /** Card surface colour. Passed through to the Card atom. Defaults to 'white'. */
  color?: CardColor
  /**
   * Active locale URL prefix (ADR-0015), supplied by the renderer. Keeps the
   * card link and CTA inside the current locale. Defaults to '' (default
   * locale — links unprefixed).
   */
  localeBasePath?: string
  /**
   * next/image `sizes` describing the width the *card* occupies in its layout
   * (a fraction-of-viewport hint), normally injected by a parent GridBlock or
   * ColumnsBlock that knows its column geometry. MediaCard scales it by
   * `layout` to the cover image's actual width before handing it to
   * next/image — see {@link LAYOUT_IMAGE_FRACTION}.
   *
   * Omit when the card's slot width is unknown (e.g. a card dropped straight
   * into a page slot): the image then keeps next/image's 100vw default rather
   * than guess a grid that may not exist.
   */
  sizes?: string
  /**
   * How urgently the cover image should load, graded by how near the top of the
   * page the card sits (supplied by the renderer via RenderContext, not
   * authored). Cards are usually below the fold, so `'lazy'` — the default —
   * is normally right; a card grid used as a page's first or second block gets
   * something more urgent. See ADR-0021 and `mediaLoadingProps`.
   */
  loadPriority?: MediaLoadPriority
  className?: string
}

/**
 * Fraction of the card's width the cover image occupies, per layout. Used to
 * scale the card-width `sizes` hint down to the image's real width.
 *
 *   above / overlay — image spans the full card → 1.
 *   beside          — image sits alongside the text at
 *                     `--media-card-beside-image-width` (default 45%); 0.5 is a
 *                     safe rounding that never under-declares at the default.
 *   dynamic         — above (full width) when the card is narrow, beside when
 *                     wide. The switch is a container query, which a viewport
 *                     `sizes` string cannot express, so we take the wider
 *                     (full-width) case — never under-declaring, at the cost of
 *                     a mild over-fetch once the card goes side-by-side.
 */
export const LAYOUT_IMAGE_FRACTION: Record<MediaCardLayout, number> = {
  above: 1,
  overlay: 1,
  beside: 0.5,
  dynamic: 1,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MediaCard molecule — a card with an optional cover image, title, body
 * copy, and a CTA.
 *
 * Composes the Card atom with `padding="none"` so the image bleeds flush
 * to the card edge; text content is padded in its own body slot.
 *
 * Layout variants:
 *   above   — image above text (default)
 *   beside  — image left, text right
 *   dynamic — container-query driven: above when narrow, beside when wide
 *   overlay — image fills the card, text overlays with a gradient scrim
 *
 * Linking:
 *   href — wraps the whole card in a link (sets Card interactive)
 *   cta  — explicit action inside the body (only when href is absent)
 *
 * Usage:
 *   <MediaCard title="Spring collection" image={…} href="/products" />
 *   <MediaCard title="Explore" description="…" layout="beside" cta={{ label: 'Shop now', href: '/shop' }} />
 *   <MediaCard title="Tile" image={…} layout="overlay" />
 */
export function MediaCard({
  title,
  description,
  media,
  links,
  layout = 'above',
  headingVariant = 'h3',
  elevation = 'flat',
  color = 'white',
  localeBasePath,
  sizes,
  loadPriority = 'lazy',
  className,
}: MediaCardProps) {
  const { href, cta } = links ?? {}
  const isLinked = href != null

  // Scale the card-width hint (if any) down to the image's real width for this
  // layout. Absent a hint, pass none — next/image falls back to 100vw.
  const imageSizes =
    sizes !== undefined ? scaleSizes(sizes, LAYOUT_IMAGE_FRACTION[layout]) : undefined

  // No per-image ratio derivation: the card layouts size the media container
  // themselves (flex-row / overlay / fixed heights in MediaCard.module.css),
  // and DynamicImage carries its own payload-resolved --di-aspect-ratio for
  // any layout that leaves the box height free.
  const mediaEl = media != null && (
    <div className={styles.media}>
      <ContentMedia
        {...media}
        {...mediaLoadingProps(loadPriority)}
        {...(imageSizes !== undefined && { sizes: imageSizes })}
        {...(styles.image !== undefined && { className: styles.image })}
      />
    </div>
  )

  const bodyEl = (
    <div className={styles.body}>
      <Typography variant={headingVariant} className={clsx(styles.title)}>
        {title}
      </Typography>

      {description && (
        <Typography variant="p" className={clsx(styles.description)}>
          {description}
        </Typography>
      )}

      {cta && (
        <div className={styles.cta}>
          {isLinked ? (
            // The whole card is already the link, so the CTA is decoration:
            // an inert <span> (nesting an <a> inside an <a> is invalid), and
            // `localeBasePath` stays behind with the card-level link.
            <Button asSpan variant={cta.variant ?? 'solid'} color={cta.color ?? 'primary'}>
              {cta.label}
            </Button>
          ) : (
            <Button
              href={cta.href}
              variant={cta.variant ?? 'solid'}
              color={cta.color ?? 'primary'}
              {...(localeBasePath !== undefined && { localeBasePath })}
            >
              {cta.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )

  const inner = (
    <div className={styles.inner} data-layout={layout}>
      {mediaEl}
      {bodyEl}
    </div>
  )

  return (
    <Card
      className={clsx('MediaCard', styles.root, className)}
      padding="none"
      elevation={elevation}
      color={color}
      interactive={isLinked}
    >
      {isLinked ? (
        <Link
          href={href}
          className={clsx(styles.link)}
          {...(localeBasePath !== undefined && { localeBasePath })}
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </Card>
  )
}
