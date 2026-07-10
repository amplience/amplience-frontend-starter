// @vitest-environment jsdom
//
// Tests for the ContentMedia molecule (QL-65).
//
// ContentMedia routes to the client DynamicImage — the delivery payload now
// carries the image dimensions (written by the di-transform extension), so no
// server-side resolution layer exists. DynamicImage is mocked here so routing
// and prop-forwarding can be tested in isolation; its own behaviour is
// covered in DynamicImage.test.tsx.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContentMediaData, DynamicImageData } from '@amplience/quadratic-types'

import { ContentMedia } from './ContentMedia'

// Stub DynamicImage as a plain <img> — no fill-mode container.
vi.mock('../DynamicImage/DynamicImage', () => ({
  DynamicImage: ({
    image,
    priority,
    className,
  }: {
    image: DynamicImageData
    priority?: boolean
    className?: string
  }) => (
    <img
      src={`https://${image.image?.image?.defaultHost ?? ''}/i/${image.image?.image?.endpoint ?? ''}/${image.image?.image?.name ?? ''}`}
      alt={image.imageAltText ?? ''}
      data-priority={priority ? 'true' : undefined}
      {...(className !== undefined && { className })}
    />
  ),
}))

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    loader,
    priority,
    ...props
  }: {
    src: string
    alt: string
    loader?: (p: { src: string; width: number }) => string
    priority?: boolean
    fill?: boolean
  }) => (
    <img
      src={loader ? loader({ src, width: 800 }) : src}
      alt={alt}
      data-priority={priority ? 'true' : undefined}
      {...props}
    />
  ),
}))

afterEach(cleanup)

const manualMedia: ContentMediaData = {
  mediaType: 'ManualImage',
  image: {
    src: '/photo.jpg',
    alt: 'A manual image',
    width: 800,
    height: 450,
  },
}

const dynamicMedia: ContentMediaData = {
  mediaType: 'DynamicImage',
  image: {
    image: {
      name: 'hero-image',
      endpoint: 'my-store',
      defaultHost: 'cdn.media.amplience.net',
    },
    query: 'sm=aspect&aspect=16:9',
    aspectLock: '16:9',
  },
  imageAltText: 'A dynamic image',
}

describe('ContentMedia', () => {
  describe('routing', () => {
    it('routes to ManualImage when mediaType is ManualImage', () => {
      render(<ContentMedia {...manualMedia} />)
      expect(screen.getByAltText('A manual image')).toBeTruthy()
    })

    it('routes to DynamicImage when mediaType is DynamicImage', () => {
      render(<ContentMedia {...dynamicMedia} />)
      expect(screen.getByAltText('A dynamic image')).toBeTruthy()
    })
  })

  describe('prop forwarding', () => {
    it('forwards priority to ManualImage', () => {
      render(<ContentMedia {...manualMedia} priority={true} />)
      expect(screen.getByAltText('A manual image').getAttribute('data-priority')).toBe('true')
    })

    it('forwards priority to DynamicImage', () => {
      render(<ContentMedia {...dynamicMedia} priority={true} />)
      expect(screen.getByAltText('A dynamic image').getAttribute('data-priority')).toBe('true')
    })

    it('does not set data-priority when priority is not provided (ManualImage)', () => {
      render(<ContentMedia {...manualMedia} />)
      expect(screen.getByAltText('A manual image').getAttribute('data-priority')).toBeNull()
    })

    it('does not set data-priority when priority is not provided (DynamicImage)', () => {
      render(<ContentMedia {...dynamicMedia} />)
      expect(screen.getByAltText('A dynamic image').getAttribute('data-priority')).toBeNull()
    })
  })
})
