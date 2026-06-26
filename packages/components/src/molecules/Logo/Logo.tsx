import clsx from 'clsx'

import { Image } from '../../atoms/Image/Image'
import type { ImageProps } from '../../atoms/Image/Image'
import styles from './Logo.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogoProps = {
  /** The logo image — all Image atom props (src, alt, width, height) apply. */
  image: ImageProps
  /**
   * Optional URL the logo links to. Omit when the logo is purely decorative
   * or when a surrounding element already provides the link.
   */
  link?: string
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
 */
export function Logo({ image, link, className }: LogoProps) {
  const img = <Image {...image} className={clsx(styles.image, image.className)} />

  if (link) {
    return (
      <a href={link} className={clsx(styles.root, className)} aria-label="Home">
        {img}
      </a>
    )
  }

  return <div className={clsx(styles.root, className)}>{img}</div>
}
