// Tests for the media registry adapter.

import { describe, expect, it } from 'vitest'

import { mediaBlockRegistryEntry } from './MediaBlock.registry'
import type { MediaBlockSchema } from './MediaBlock.registry'

const validMedia: MediaBlockSchema = {
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/media' },
  media: {
    mediaType: 'ManualImage',
    image: {
      src: '/photo.jpg',
      alt: 'A test photo',
      width: 1200,
      height: 800,
    },
  },
  caption: 'Optional fields are fine.',
}

describe('mediaBlockRegistryEntry.propsFromSchema', () => {
  const adapt = mediaBlockRegistryEntry.propsFromSchema

  it('strips the _meta envelope and passes the remaining fields through', () => {
    expect(adapt?.(validMedia, {})).toMatchObject({
      media: validMedia.media,
      caption: validMedia.caption,
    })
    expect(adapt?.(validMedia, {})).not.toHaveProperty('_meta')
  })

  it('sets bare from the render context, defaulting to false', () => {
    expect(adapt?.(validMedia, {})?.bare).toBe(false)
    expect(adapt?.(validMedia, { bare: true })?.bare).toBe(true)
  })

  it('sets isTopOfPage from the render context, defaulting to false', () => {
    expect(adapt?.(validMedia, {})?.isTopOfPage).toBe(false)
    expect(adapt?.(validMedia, { isTopOfPage: true })?.isTopOfPage).toBe(true)
  })

  it('forwards the parent slot width as sizes when present', () => {
    expect(adapt?.(validMedia, { slotSizes: '(min-width: 769px) 50vw, 100vw' })?.sizes).toBe(
      '(min-width: 769px) 50vw, 100vw',
    )
  })

  it('leaves sizes unset when the context supplies no slot width', () => {
    expect(adapt?.(validMedia, {})).not.toHaveProperty('sizes')
  })
})
