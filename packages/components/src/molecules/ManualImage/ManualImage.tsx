import type { ManualImageData } from '@amplience/frontend-starter-types'

import { Image } from '../../atoms/Image/Image'

export type ManualImageProps = ManualImageData & {
  priority?: boolean
  /**
   * Explicit `fetchpriority` for the underlying `<img>`. next/image v16 no
   * longer derives it from `priority`, so an LCP candidate needs it set
   * (ADR-0021).
   */
  fetchPriority?: 'auto' | 'high' | 'low'
  /**
   * `eager` loads the image immediately without the preload hint `priority`
   * adds — an above-the-fold image that isn't the LCP candidate (ADR-0021).
   */
  loading?: 'eager' | 'lazy'
  /**
   * Hint to the browser about the rendered width of this image at various
   * viewport widths — forwarded to next/image's `sizes` prop.
   *
   * Without it next/image assumes `sizes="100vw"` and picks a full-viewport
   * srcset candidate, over-fetching for images rendered in a partial-width
   * slot (e.g. a MediaCard in a multi-column grid). Partial-width consumers
   * should pass a value matching their layout.
   */
  sizes?: string
  className?: string
}

export function ManualImage({
  mediaType: _mediaType,
  image: { aspectRatio, src, width, height, alt },
  priority,
  fetchPriority,
  loading,
  sizes,
  className,
}: ManualImageProps) {
  const optionals = {
    ...(aspectRatio !== undefined && { aspectRatio }),
    ...(priority !== undefined && { priority }),
    ...(fetchPriority !== undefined && { fetchPriority }),
    ...(loading !== undefined && { loading }),
    ...(sizes !== undefined && { sizes }),
    ...(className !== undefined && { className }),
  }
  return <Image src={src} alt={alt} width={width} height={height} {...optionals} />
}
