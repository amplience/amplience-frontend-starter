import clsx from 'clsx'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { Link } from '../../atoms/Link/Link'
import { ContentMedia } from '../ContentMedia/ContentMedia'
import styles from './Logo.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogoProps = {
  /**
   * The logo media — ManualImage (direct URL) or DynamicImage (an asset
   * picked from the Amplience DAM via the image-poi extension).
   */
  image: ContentMediaData
  /**
   * Optional URL the logo links to. Omit when the logo is purely decorative
   * or when a surrounding element already provides the link.
   */
  link?: string
  /**
   * Active locale URL prefix (ADR-0015), supplied by the renderer. Keeps the
   * home link inside the current locale. Defaults to '' (default locale).
   */
  localeBasePath?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Logo molecule — a brand logo image with an optional home link.
 *
 * When `link` is provided the image is wrapped in an `<a>` with
 * aria-label="Home" so screen readers identify the destination. Without
 * `link` the image is wrapped in a neutral `<div>`.
 *
 * Height is controlled via the --logo-height CSS custom property so brands
 * can resize without touching this file:
 *   [data-brand="acme"] { --logo-height: 56px; }
 *
 * Sizing note: `.image` sets a fixed height with `width: auto`. For a
 * DynamicImage that class lands on the fill-mode container, whose width then
 * derives from the payload-resolved --di-aspect-ratio — so the logo keeps
 * its natural proportions at any --logo-height.
 */
export function Logo({ image, link, localeBasePath, className }: LogoProps) {
  // A logo renders at --logo-height (~40–56px), so hint a small slot width —
  // without this, next/image's default 100vw sizes hint would preload a
  // viewport-sized asset for a 40px-tall logo.
  const img = (
    <ContentMedia
      {...image}
      sizes="200px"
      {...(styles.image !== undefined && { className: styles.image })}
    />
  )

  if (link) {
    return (
      <Link
        href={link}
        className={clsx('Logo', styles.root, className)}
        aria-label="Home"
        {...(localeBasePath !== undefined && { localeBasePath })}
      >
        {img}
      </Link>
    )
  }

  return <div className={clsx('Logo', styles.root, className)}>{img}</div>
}
