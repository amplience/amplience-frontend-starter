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
 * has no media body to narrow, and gets `undefined` back. That is the honest
 * answer: the components' Dynamic Media path needs an Amplience asset, and a
 * PIM image is not one. Wiring the plain-URL path through to an `<img>` is a
 * real gap, and it will want solving when the first PIM lands rather than
 * being faked now.
 */

import type { ProductImage } from '@amplience/frontend-starter-content'
import type { ContentMediaData } from '@amplience/frontend-starter-types'

const MEDIA_TYPES = ['ManualImage', 'DynamicImage']

const isContentMediaData = (value: unknown): value is ContentMediaData => {
  if (typeof value !== 'object' || value === null) return false
  const { mediaType } = value as { mediaType?: unknown }
  return typeof mediaType === 'string' && MEDIA_TYPES.includes(mediaType)
}

/** The renderable media for one product image, when it has an Amplience body. */
export const productMedia = (image: ProductImage | undefined): ContentMediaData | undefined =>
  isContentMediaData(image?.media) ? image.media : undefined

/** The renderable media for every image that has one, in order. */
export const productMediaList = (
  images: readonly ProductImage[] | undefined,
): readonly ContentMediaData[] =>
  (images ?? []).map(productMedia).filter((m): m is ContentMediaData => m !== undefined)
