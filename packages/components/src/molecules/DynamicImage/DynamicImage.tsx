'use client'

import clsx from 'clsx'
import NextImage from 'next/image'
import type { CSSProperties } from 'react'

import type { DynamicImageData } from '@amplience/frontend-starter-types'

import { amplienceDiLoader, buildDiBaseUrl, resolveDiAspectRatio } from './di-utils'
import styles from './DynamicImage.module.css'

export type DynamicImageProps = {
  image: DynamicImageData
  priority?: boolean
  fetchPriority?: 'auto' | 'high' | 'low'
  /**
   * `eager` loads the image immediately without the preload hint `priority`
   * adds — an above-the-fold image that isn't the LCP candidate (ADR-0021).
   */
  loading?: 'eager' | 'lazy'
  /**
   * Hint to the browser about the rendered width of this image at various
   * viewport widths — passed directly to next/image's `sizes` prop.
   *
   * next/image uses this alongside device pixel ratio to pick the right
   * srcset entry. A retina screen at 480px will request a ~960px image,
   * correctly sharper than a 1× screen would.
   *
   * Defaults to "100vw" (full viewport width — correct for hero/full-bleed
   * images). MediaCard and other partial-width consumers should pass a more
   * specific value, e.g. "(max-width: 480px) 100vw, 360px".
   */
  sizes?: string
  className?: string
}

export function DynamicImage({
  image,
  priority,
  fetchPriority,
  loading,
  sizes = '100vw',
  className,
}: DynamicImageProps) {
  const link = image.image?.image
  if (!link?.name || !link?.endpoint || !link?.defaultHost) return null

  const query = image.image.query
  const alt = image.imageAltText ?? ''

  // src = base URL + pre-baked DI query string (no width — the loader appends that).
  // The image-poi extension stores query params without a leading '?' (e.g. "crop={...},..."),
  // so we normalise the separator here rather than assuming the field starts with '?'.
  const baseUrl = buildDiBaseUrl(link)
  const src = query
    ? query.startsWith('?')
      ? `${baseUrl}${query}`
      : `${baseUrl}?${query}`
    : baseUrl

  // Resolve aspect ratio from the delivery payload alone: the delivered-image
  // ratio (aspectRatio, or width/height) the di-transform extension wrote at
  // pick time — crop applied when one is drawn, otherwise the original's.
  // No network, no server dependency — renders identically on the site (RSC)
  // and in the /visualization live-edit loop (client). If the payload predates
  // the extension writing dimensions, no ratio is set — contexts that impose
  // an explicit height (HeroBlock overlay, MediaCard) still render;
  // height-free contexts (MediaBlock) will collapse rather than guess wrongly
  // (re-save the content item to write the dimensions in).
  //
  // The ratio is exposed as the --di-aspect-ratio custom property (consumed by
  // .root in the CSS module) rather than an inline `aspect-ratio`, so layout
  // contexts that size this container themselves (e.g. HeroBlock's 'flexible'
  // grid, which uses a ::before spacer for the image height) can override it
  // with `aspect-ratio: auto` — impossible against an inline declaration.
  const cssAspect = resolveDiAspectRatio(image.image)
  const containerStyle = (cssAspect ? { '--di-aspect-ratio': cssAspect } : {}) as CSSProperties

  return (
    <div className={clsx('DynamicImage', styles.root, className)} style={containerStyle}>
      {/*
        fill mode: next/image renders position:absolute; width:100%; height:100%.
        The container's aspect-ratio (above) defines the box shape and prevents
        layout shift while the image loads.
        amplienceDiLoader appends fmt=webp&w={width} — browser picks width × DPR automatically.
      */}
      <NextImage
        loader={amplienceDiLoader}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        {...(priority !== undefined && { priority })}
        {...(fetchPriority !== undefined && { fetchPriority })}
        {...(loading !== undefined && { loading })}
        className={styles.img}
      />
    </div>
  )
}
