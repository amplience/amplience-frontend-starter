/**
 * `ProductImage` → `ContentMediaData` — the one place the two meet.
 *
 * The port deliberately keeps `ProductImage.media` opaque (`ContentBody`), so
 * `packages/content` need not depend on `packages/types`; the components take
 * `ContentMediaData`. This deployment knows both, so the narrowing lives here
 * rather than being cast at each call site.
 *
 * It is a guard, not a cast. A source that supplies only a plain `url` — any
 * PIM, since commercetools, Shopify, BigCommerce and SFCC all return URLs —
 * has no media body to narrow, so the URL is turned into one here:
 *
 *  - **An Amplience Dynamic Media URL** (`https://<host>/i/<endpoint>/<name>`)
 *    becomes a `DynamicImage`, which keeps the DI loader and its responsive
 *    `srcset` (ADR-0021). PIMs fed from Amplience DAM — AnyaFinn in
 *    commercetools is one — hand back exactly these URLs.
 *  - **Any other URL with known dimensions** becomes a `ManualImage`.
 *  - **A URL with no dimensions** stays unrenderable: `ManualImage` needs a
 *    box size, and guessing one would lay the page out wrong.
 */

import type { ProductImage } from '@amplience/frontend-starter-content'
import type { ContentMediaData } from '@amplience/frontend-starter-types'

const MEDIA_TYPES = ['ManualImage', 'DynamicImage']

const isContentMediaData = (value: unknown): value is ContentMediaData => {
  if (typeof value !== 'object' || value === null) return false
  const { mediaType } = value as { mediaType?: unknown }
  return typeof mediaType === 'string' && MEDIA_TYPES.includes(mediaType)
}

/** Hosts that serve Amplience Dynamic Media, by suffix. */
const DI_HOST_SUFFIXES = ['.amplience.net', '.bigcontent.io']

/**
 * `https://cdn.media.amplience.net/i/acme/red-dress?w=800` →
 * `{ defaultHost, endpoint, name, query }`, or `undefined` for any other URL.
 */
export const parseDiUrl = (
  url: string,
): { defaultHost: string; endpoint: string; name: string; query?: string } | undefined => {
  const match = /^https:\/\/([^/?#]+)\/i\/([^/?#]+)\/([^?#]+)(?:\?([^#]*))?$/.exec(url)
  if (!match) return undefined
  const [, host, endpoint, name, query] = match
  if (!host || !endpoint || !name) return undefined
  if (!DI_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return undefined
  return {
    defaultHost: host,
    endpoint,
    name: decodeURIComponent(name),
    ...(query ? { query } : {}),
  }
}

/** A media body for a URL-only image — see the module comment for the rules. */
const mediaFromUrl = (image: ProductImage): ContentMediaData | undefined => {
  const di = parseDiUrl(image.url)
  if (di) {
    const { query, ...link } = di
    return {
      mediaType: 'DynamicImage',
      image: {
        image: link,
        ...(query ? { query } : {}),
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {}),
        ...(image.width && image.height ? { aspectRatio: image.width / image.height } : {}),
      },
      ...(image.alt ? { imageAltText: image.alt } : {}),
    }
  }
  if (image.width && image.height) {
    return {
      mediaType: 'ManualImage',
      image: { src: image.url, alt: image.alt ?? '', width: image.width, height: image.height },
    }
  }
  return undefined
}

/**
 * The renderable media for one product image: its Amplience body when it has
 * one, else one built from its URL.
 */
export const productMedia = (image: ProductImage | undefined): ContentMediaData | undefined => {
  if (image === undefined) return undefined
  if (isContentMediaData(image.media)) return image.media
  // next/image throws on a leading space, which blanks the whole page — so a
  // stray space in PIM data must never reach it, whichever adapter let it by.
  return mediaFromUrl({ ...image, url: image.url.trim() })
}

/** The renderable media for every image that has one, in order. */
export const productMediaList = (
  images: readonly ProductImage[] | undefined,
): readonly ContentMediaData[] =>
  (images ?? []).map(productMedia).filter((m): m is ContentMediaData => m !== undefined)
