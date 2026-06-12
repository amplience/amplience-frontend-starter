// Tests for the image registry adapter — the render-context cues (`bare`,
// `isTopOfPage`) are renderer-supplied, not authored, so the adapter is the
// seam that turns context into props.

import { describe, expect, it } from 'vitest'

import { imageBlockRegistryEntry } from './ImageBlock.registry'
import type { ImageBlockSchema } from './ImageBlock.registry'

const validImage: ImageBlockSchema = {
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/image' },
  image: { src: '/photo.jpg', alt: 'A test photo', width: 1200, height: 800 },
  caption: 'Optional fields are fine.',
}

describe('imageBlockRegistryEntry.propsFromSchema', () => {
  const adapt = imageBlockRegistryEntry.propsFromSchema

  it('strips the _meta envelope and passes the remaining fields through', () => {
    expect(adapt?.(validImage, {})).toMatchObject({
      image: validImage.image,
      caption: validImage.caption,
    })
    expect(adapt?.(validImage, {})).not.toHaveProperty('_meta')
  })

  it('sets bare from the render context, defaulting to false', () => {
    expect(adapt?.(validImage, {})?.bare).toBe(false)
    expect(adapt?.(validImage, { bare: true })?.bare).toBe(true)
  })

  it('sets isTopOfPage from the render context, defaulting to false', () => {
    expect(adapt?.(validImage, {})?.isTopOfPage).toBe(false)
    expect(adapt?.(validImage, { isTopOfPage: true })?.isTopOfPage).toBe(true)
  })
})
