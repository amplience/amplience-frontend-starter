import { describe, expect, it } from 'vitest'

import type { ProductImage } from '@amplience/frontend-starter-content'

import { parseDiUrl, productMedia, productMediaList } from './product-media'

describe('parseDiUrl', () => {
  it('parses an Amplience Dynamic Media URL', () => {
    expect(parseDiUrl('https://cdn.media.amplience.net/i/anyafinn/af-skirt-001')).toEqual({
      defaultHost: 'cdn.media.amplience.net',
      endpoint: 'anyafinn',
      name: 'af-skirt-001',
    })
  })

  it('keeps a query string as pre-baked transforms', () => {
    expect(
      parseDiUrl('https://cdn.media.amplience.net/i/acme/shoe?sm=aspect&aspect=1:1'),
    ).toMatchObject({
      name: 'shoe',
      query: 'sm=aspect&aspect=1:1',
    })
  })

  it('rejects other hosts and other paths', () => {
    expect(parseDiUrl('https://images.example.com/i/acme/shoe')).toBeUndefined()
    expect(parseDiUrl('https://cdn.media.amplience.net/v/acme/video')).toBeUndefined()
    expect(parseDiUrl('http://cdn.media.amplience.net/i/acme/shoe')).toBeUndefined()
  })
})

describe('productMedia', () => {
  it('prefers an Amplience media body when the source supplies one', () => {
    // The CMS adapter passes the delivery media body through as-is.
    const media = {
      mediaType: 'ManualImage',
      image: { src: 'x', alt: '', width: 1, height: 1 },
    } as unknown as NonNullable<ProductImage['media']>
    expect(productMedia({ url: 'https://cdn.media.amplience.net/i/a/b', media })).toBe(media)
  })

  it('turns a PIM-supplied DI URL into a DynamicImage', () => {
    expect(
      productMedia({
        url: 'https://cdn.media.amplience.net/i/anyafinn/af-skirt-001',
        alt: 'Front',
        width: 1200,
        height: 1600,
      }),
    ).toEqual({
      mediaType: 'DynamicImage',
      image: {
        image: {
          defaultHost: 'cdn.media.amplience.net',
          endpoint: 'anyafinn',
          name: 'af-skirt-001',
        },
        width: 1200,
        height: 1600,
        aspectRatio: 0.75,
      },
      imageAltText: 'Front',
    })
  })

  it('turns any other URL with dimensions into a ManualImage', () => {
    expect(
      productMedia({ url: 'https://images.example.com/lamp.jpg', width: 800, height: 800 }),
    ).toEqual({
      mediaType: 'ManualImage',
      image: { src: 'https://images.example.com/lamp.jpg', alt: '', width: 800, height: 800 },
    })
  })

  it('leaves a non-DI URL with no dimensions unrenderable', () => {
    expect(productMedia({ url: 'https://images.example.com/lamp.jpg' })).toBeUndefined()
    expect(productMediaList([{ url: 'https://images.example.com/lamp.jpg' }])).toEqual([])
  })
})
