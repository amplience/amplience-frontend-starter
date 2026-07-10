import type { ContentMediaData } from '@amplience/quadratic-types'

import { DynamicImage } from '../DynamicImage/DynamicImage'
import { ManualImage } from '../ManualImage/ManualImage'

export type ContentMediaProps = ContentMediaData & {
  priority?: boolean
  fetchPriority?: 'auto' | 'high' | 'low'
  sizes?: string
  className?: string
}

export function ContentMedia({
  priority,
  fetchPriority,
  sizes,
  className,
  ...mediaData
}: ContentMediaProps) {
  const optionals = {
    ...(priority !== undefined && { priority }),
    ...(fetchPriority !== undefined && { fetchPriority }),
    ...(sizes !== undefined && { sizes }),
    ...(className !== undefined && { className }),
  }
  if (mediaData.mediaType === 'DynamicImage') {
    return <DynamicImage image={mediaData} {...optionals} />
  }
  return <ManualImage {...mediaData} {...optionals} />
}
