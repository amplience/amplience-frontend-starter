import { describe, expect, it } from 'vitest'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { isImageMedia, isVideoMedia } from './media-guards'

const link = { name: 'a', endpoint: 'b', defaultHost: 'c' }
const cases: [ContentMediaData, boolean][] = [
  [{ mediaType: 'DynamicImage', image: { image: link } }, true],
  [{ mediaType: 'ManualImage', image: { src: '/a.jpg', alt: '', width: 1, height: 1 } }, true],
  [{ mediaType: 'DynamicVideo', video: link }, false],
  [{ mediaType: 'ExternalVideo', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'x' }, false],
]

describe('media guards', () => {
  it.each(cases)('%o → image: %s', (media, image) => {
    expect(isImageMedia(media)).toBe(image)
    expect(isVideoMedia(media)).toBe(!image)
  })
})
