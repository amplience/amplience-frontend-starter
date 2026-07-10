import clsx from 'clsx'

import type { ContentMediaData } from '@amplience/quadratic-types'

import { Button } from '../../atoms/Button/Button'
import type { ButtonColor, ButtonVariant } from '../../atoms/Button/Button'
import { Card } from '../../atoms/Card/Card'
import type { CardColor, CardElevation } from '../../atoms/Card/Card'
import { Link } from '../../atoms/Link/Link'
import { Typography } from '../../atoms/Typography/Typography'
import { ContentMedia } from '../ContentMedia/ContentMedia'
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
  className?: string
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
  elevation = 'raised',
  color = 'white',
  className,
}: MediaCardProps) {
  const { href, cta } = links ?? {}
  const isLinked = href != null

  // No per-image ratio derivation: the card layouts size the media container
  // themselves (flex-row / overlay / fixed heights in MediaCard.module.css),
  // and DynamicImage carries its own payload-resolved --di-aspect-ratio for
  // any layout that leaves the box height free.
  const mediaEl = media != null && (
    <div className={styles.media}>
      <ContentMedia {...media} {...(styles.image !== undefined && { className: styles.image })} />
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

      {/* CTA only renders when the card is not already a full-card link */}
      {!isLinked && cta && (
        <div className={styles.cta}>
          <Button href={cta.href} variant={cta.variant ?? 'solid'} color={cta.color ?? 'primary'}>
            {cta.label}
          </Button>
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
      className={clsx(styles.root, className)}
      padding="none"
      elevation={elevation}
      color={color}
      interactive={isLinked}
    >
      {isLinked ? (
        <Link href={href} className={clsx(styles.link)}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </Card>
  )
}
