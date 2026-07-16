import clsx from 'clsx'
import NextImage from 'next/image'
import type { ComponentPropsWithoutRef } from 'react'

import styles from './Image.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OwnProps = {
  /** Accessible description of the image. Required for non-decorative images. */
  alt: string
  /** Intrinsic width in pixels. Required by Next.js for layout calculation. */
  width: number
  /** Intrinsic height in pixels. Required by Next.js for layout calculation. */
  height: number
  /**
   * Optional CSS aspect-ratio string (e.g. "16 / 9", "1 / 1").
   * When supplied, overrides the intrinsic ratio via a CSS variable so the
   * image fills its container at the specified ratio regardless of the
   * rendered width. Uses `object-fit: cover` to avoid distortion.
   *
   * This is the documented exception for runtime values (ADR-0002 §9):
   * the value is CMS-authored and only known at render time.
   */
  aspectRatio?: string
  className?: string
}

/**
 * Remaining props forwarded to Next.js `<Image>` — src, priority, quality,
 * sizes, fill, onLoad, etc. `alt`, `width`, `height` are typed explicitly
 * above; the rest come through automatically.
 */
export type ImageProps = OwnProps & Omit<ComponentPropsWithoutRef<typeof NextImage>, keyof OwnProps>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around Next.js `<Image>` that adds:
 * - typed, required `alt` (no silent empty-string escapes)
 * - optional `aspectRatio` — a CSS-variable-driven ratio override for
 *   CMS-authored images where the intrinsic ratio may not match the slot
 * - consistent CSS module class so brand layers can target `.root`
 *
 * Usage:
 *   <Image src="/hero.jpg" alt="Hero" width={1200} height={600} />
 *   <Image src={url} alt={alt} width={800} height={600} aspectRatio="4 / 3" />
 */
export function Image({ src, alt, width, height, aspectRatio, className, ...rest }: ImageProps) {
  return (
    <NextImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={clsx('Image', styles.root, className)}
      // aspectRatio is a runtime value from CMS — inline style is the
      // documented exception per ADR-0002 §9.
      style={
        aspectRatio ? ({ '--image-aspect-ratio': aspectRatio } as React.CSSProperties) : undefined
      }
      data-has-ratio={aspectRatio ? 'true' : undefined}
      {...rest}
    />
  )
}
