import { getImageProps } from 'next/image'

import type { ContentMediaData } from '@amplience/quadratic-types'

import {
  amplienceDiLoader,
  buildDiBaseUrl,
  cssRatioToNumber,
  resolveContentMediaAspectRatio,
} from '../DynamicImage/di-utils'
import styles from './ArtDirectedMedia.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtDirectedMediaProps = {
  /** The default image — the fallback <img> and the >breakpoint source. */
  desktop: ContentMediaData
  /** The art-directed override shown at or below `mobileMaxWidth`. */
  mobile: ContentMediaData
  /** Max viewport width (px) at which the mobile image is used. Default 768. */
  mobileMaxWidth?: number
  /**
   * True for the page's LCP hero. Loads the fallback <img> eagerly and emits
   * a per-breakpoint <link rel="preload"> so only the matched image preloads
   * (mobile visitors never preload the desktop asset, and vice versa).
   */
  priority?: boolean
  fetchPriority?: 'auto' | 'high' | 'low'
  /** next/image `sizes` hint. Full-bleed hero defaults to 100vw. */
  sizes?: string
  className?: string
}

// getImageProps' input type, without re-deriving the whole next/image surface.
type ImageArgs = Parameters<typeof getImageProps>[0]

// ---------------------------------------------------------------------------
// Media → getImageProps args
// ---------------------------------------------------------------------------

/**
 * Builds the getImageProps input for one ContentMedia value, so both the
 * desktop fallback and the mobile <source> run through the same next/image
 * optimiser pipeline (default loader for ManualImage, amplienceDiLoader for
 * DynamicImage). Returns null for an unresolvable payload — the caller then
 * degrades rather than crashing the static build.
 */
function toImageArgs(
  media: ContentMediaData,
  common: { sizes: string; priority?: boolean; fetchPriority?: 'auto' | 'high' | 'low' },
): (ImageArgs & { alt: string }) | null {
  if (media.mediaType === 'ManualImage' && media.image !== undefined) {
    const { src, alt, width, height } = media.image
    return { src, alt, width, height, ...common }
  }

  if (media.mediaType === 'DynamicImage' && media.image !== undefined) {
    const link = media.image.image
    if (!link?.name || !link?.endpoint || !link?.defaultHost) return null

    // Mirror DynamicImage.tsx: base URL + pre-baked DI query (no width — the
    // loader appends it per srcset entry). The image-poi extension stores the
    // query without a leading '?', so normalise the separator.
    const base = buildDiBaseUrl(link)
    const query = media.image.query
    const src = query ? (query.startsWith('?') ? `${base}${query}` : `${base}?${query}`) : base

    // DynamicImage carries no intrinsic pixel size, but next/image needs a
    // width/height to seed the srcset and reserve a shift-free box. A ratio is
    // enough: fix a representative width and derive the height. CSS
    // (object-fit: cover) governs the actual rendered pixels; these values only
    // drive srcset generation and the <img>/<source> intrinsic ratio.
    const ratio = cssRatioToNumber(resolveContentMediaAspectRatio(media)) ?? 16 / 9
    const width = 1600
    const height = Math.round(width / ratio)
    const alt = media.imageAltText ?? ''

    return { src, alt, width, height, loader: amplienceDiLoader, ...common }
  }

  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Art-directed responsive image — a real <picture> with a mobile <source> and
 * a desktop fallback <img>, both generated through next/image's `getImageProps`
 * so they share the optimiser/loader pipeline. The browser downloads only the
 * matched candidate (no CSS-hidden duplicate that both fetch), and each
 * <source>/<img> carries width/height so a differing mobile aspect ratio still
 * reserves a shift-free box (no CLS).
 *
 * Server component: `getImageProps` needs no client runtime, so the hero stays
 * fully static/SSG. When `priority` is set, a per-breakpoint preload hint is
 * emitted (React hoists <link> to <head>) — strictly better than next/image's
 * single preload, which cannot be scoped to a media query.
 *
 * `display: contents` on the <picture> keeps the <img> as the layout element,
 * so the consuming block's image CSS (object-fit, width/height) applies exactly
 * as it does to a plain ContentMedia render.
 */
export function ArtDirectedMedia({
  desktop,
  mobile,
  mobileMaxWidth = 768,
  priority,
  fetchPriority,
  sizes = '100vw',
  className,
}: ArtDirectedMediaProps) {
  const common = {
    sizes,
    ...(priority !== undefined && { priority }),
    ...(fetchPriority !== undefined && { fetchPriority }),
  }

  const desktopArgs = toImageArgs(desktop, common)
  // No resolvable desktop image — nothing safe to render. Matches ContentMedia's
  // "skip rather than crash" contract for legacy/malformed payloads.
  if (desktopArgs === null) return null

  const mobileArgs = toImageArgs(mobile, common)

  const { props: desktopProps } = getImageProps(desktopArgs)
  const mobileProps = mobileArgs !== null ? getImageProps(mobileArgs).props : null

  const mobileMedia = `(max-width: ${mobileMaxWidth}px)`
  const desktopMedia = `(min-width: ${mobileMaxWidth + 1}px)`

  return (
    <>
      {priority === true && mobileProps !== null && (
        <>
          <link
            rel="preload"
            as="image"
            media={mobileMedia}
            fetchPriority={fetchPriority ?? 'high'}
            imageSrcSet={mobileProps.srcSet}
            imageSizes={mobileProps.sizes}
          />
          <link
            rel="preload"
            as="image"
            media={desktopMedia}
            fetchPriority={fetchPriority ?? 'high'}
            imageSrcSet={desktopProps.srcSet}
            imageSizes={desktopProps.sizes}
          />
        </>
      )}
      <picture className={styles.picture}>
        {mobileProps !== null && (
          <source
            media={mobileMedia}
            srcSet={mobileProps.srcSet}
            sizes={mobileProps.sizes}
            width={mobileArgs?.width}
            height={mobileArgs?.height}
          />
        )}
        {/*
          A bare <img> is required — <picture> art direction needs the <img> as
          its last child, and next/image's component output isn't compatible.
          Optimisation (srcset, sizing, format) is preserved via getImageProps.
        */}
        <img
          {...desktopProps}
          alt={desktopArgs.alt}
          {...(className !== undefined && { className })}
        />
      </picture>
    </>
  )
}
