import type { ImageLoaderProps } from 'next/image'

import type {
  AmplienceImageLink,
  ContentMediaData,
  TransformedImageField,
} from '@amplience/quadratic-types'

/**
 * QL design system breakpoints — kept here as the canonical reference for
 * the `sizes` prop values used by DynamicImage consumers.
 *
 *   sm  480  — compact mobile
 *   md  768  — tablet / large mobile
 *   lg  1024 — small desktop
 *   xl  1200 — standard desktop (matches --site-max-width)
 */
export const DI_BREAKPOINTS = [
  { name: 'sm', width: 480 },
  { name: 'md', width: 768 },
  { name: 'lg', width: 1024 },
  { name: 'xl', width: 1200 },
] as const satisfies readonly { name: string; width: number }[]

export type DiBreakpoint = (typeof DI_BREAKPOINTS)[number]

/** https://{defaultHost}/i/{endpoint}/{encodedName} */
export function buildDiBaseUrl(image: AmplienceImageLink): string {
  return `https://${image.defaultHost}/i/${image.endpoint}/${encodeURIComponent(image.name)}`
}

/**
 * next/image custom loader for Amplience Dynamic Imaging.
 *
 * The `src` prop passed to <Image> should be the base DI URL plus the
 * pre-baked query string from the image-poi extension, e.g.:
 *   "https://cdn.media.amplience.net/i/demo/hero?sm=aspect&aspect=16:9"
 *
 * next/image calls this loader for each width in its deviceSizes config,
 * producing a srcset of DI URLs. The browser picks the right one based on
 * the `sizes` hint and device pixel ratio — retina screens automatically
 * receive a higher-resolution image.
 */
export function amplienceDiLoader({ src, width }: ImageLoaderProps): string {
  // src may or may not already have a query string
  const separator = src.includes('?') ? '&' : '?'
  return `${src}${separator}fmt=webp&w=${width}`
}

/**
 * Converts an aspectLock string ("16:9") to a CSS aspect-ratio value ("16 / 9").
 * Returns undefined if input is absent or not in N:N format.
 */
export function aspectLockToCss(aspectLock: string | undefined): string | undefined {
  if (!aspectLock) return undefined
  const parts = aspectLock.split(':')
  if (parts.length !== 2) return undefined
  return `${parts[0]} / ${parts[1]}`
}

/**
 * Resolves the CSS aspect-ratio for an image-poi field from the delivery
 * payload alone — no network, works identically in server and client renders
 * (the constraint the /visualization live-edit loop imposes).
 *
 * Sources, in order:
 *  1. `aspectLock` — the ratio the author explicitly locked ("16:9").
 *  2. `aspectRatio` — the rendered ratio (crop-aware decimal, e.g. 1.7264)
 *     written into the field by the di-transform extension at pick time.
 *  3. `srcWidth` / `srcHeight` — original asset dimensions, also written by
 *     the extension. Only used when the query carries no crop, since they
 *     describe the uncropped original.
 *
 * Returns undefined when none apply (content authored before the extension
 * wrote dimensions) — callers render without a ratio rather than guessing.
 */
/**
 * Resolves a ContentMedia value to a plain image URL — for consumers that
 * need a URL rather than a rendered component: og:image / social-card tags,
 * RSS enclosures, JSON-LD.
 *
 *  - ManualImage  — the authored src, as-is.
 *  - DynamicImage — the DI URL with the pre-baked transform query (crop, POI)
 *    plus an optional width cap. No `fmt` override: DI serves the asset's
 *    stored format (jpg/png), which social scrapers handle universally.
 *
 * Returns undefined when a DynamicImage link is incomplete.
 */
export function contentMediaUrl(
  media: ContentMediaData,
  opts: { readonly width?: number } = {},
): string | undefined {
  if (media.mediaType === 'ManualImage') return media.image.src

  const link = media.image.image
  if (!link?.name || !link?.endpoint || !link?.defaultHost) return undefined

  const base = buildDiBaseUrl(link)
  const query = media.image.query?.replace(/^\?/, '')
  const params = [query, opts.width !== undefined ? `w=${opts.width}` : undefined]
    .filter(Boolean)
    .join('&')
  return params ? `${base}?${params}` : base
}

export function resolveDiAspectRatio(field: TransformedImageField): string | undefined {
  const locked = aspectLockToCss(field.aspectLock)
  if (locked !== undefined) return locked

  if (typeof field.aspectRatio === 'number' && field.aspectRatio > 0) {
    // A single number is a valid CSS aspect-ratio value.
    return String(field.aspectRatio)
  }

  const { srcWidth, srcHeight } = field
  const hasCrop = field.query?.includes('crop=') ?? false
  if (
    !hasCrop &&
    typeof srcWidth === 'number' &&
    typeof srcHeight === 'number' &&
    srcWidth > 0 &&
    srcHeight > 0
  ) {
    return `${srcWidth} / ${srcHeight}`
  }

  return undefined
}
