import type { ContentMediaData } from '@amplience/quadratic-types'

import { DynamicImage } from '../DynamicImage/DynamicImage'
import { ManualImage } from '../ManualImage/ManualImage'

export type ContentMediaProps = ContentMediaData & {
  priority?: boolean
  fetchPriority?: 'auto' | 'high' | 'low'
  /**
   * `eager` opts the image out of lazy loading without the preload hint
   * `priority` adds — the above-the-fold-but-not-LCP case (ADR-0021). Callers
   * should get this from `mediaLoadingProps` rather than setting it directly.
   */
  loading?: 'eager' | 'lazy'
  sizes?: string
  className?: string
}

export function ContentMedia({
  priority,
  fetchPriority,
  loading,
  sizes,
  className,
  ...mediaData
}: ContentMediaProps) {
  const optionals = {
    ...(priority !== undefined && { priority }),
    ...(fetchPriority !== undefined && { fetchPriority }),
    ...(loading !== undefined && { loading }),
    ...(sizes !== undefined && { sizes }),
    ...(className !== undefined && { className }),
  }
  if (mediaData.mediaType === 'DynamicImage') {
    return <DynamicImage image={mediaData} {...optionals} />
  }
  if (mediaData.mediaType === 'ManualImage' && mediaData.image !== undefined) {
    return <ManualImage {...mediaData} {...optionals} />
  }
  // Unrecognised media shape — a legacy payload (pre-media-partial flat
  // image) or a hub item not yet re-saved. Render nothing rather than crash
  // (a ManualImage destructure of a missing `image` would otherwise throw
  // "Cannot read properties of undefined (reading 'aspectRatio')" and fail
  // the whole static build). The warning names the shape so stale content
  // is findable in build logs.
  console.warn('[ContentMedia] unrecognised media shape — skipping render', {
    mediaType: (mediaData as { mediaType?: unknown }).mediaType,
  })
  return null
}
