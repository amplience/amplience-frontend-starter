import type { ManualImageData } from '@amplience/quadratic-types'

import { Image } from '../../atoms/Image/Image'

export type ManualImageProps = ManualImageData & {
  priority?: boolean
  className?: string
}

export function ManualImage({
  mediaType: _mediaType,
  image: { aspectRatio, src, width, height, alt },
  priority,
  className,
}: ManualImageProps) {
  const optionals = {
    ...(aspectRatio !== undefined && { aspectRatio }),
    ...(priority !== undefined && { priority }),
    ...(className !== undefined && { className }),
  }
  return <Image src={src} alt={alt} width={width} height={height} {...optionals} />
}
