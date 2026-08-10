// @vitest-environment jsdom
//
// Tests for the ManualImage molecule (QL-65).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ManualImageData } from '@amplience/quadratic-types'

import { ManualImage } from './ManualImage'

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    priority,
    ...props
  }: React.ComponentPropsWithoutRef<'img'> & { priority?: boolean }) => (
    <img src={src} alt={alt} data-priority={priority ? 'true' : undefined} {...props} />
  ),
}))

afterEach(cleanup)

const sampleMedia: ManualImageData = {
  mediaType: 'ManualImage',
  image: {
    src: '/hero.jpg',
    alt: 'Hero image',
    width: 1200,
    height: 600,
  },
}

describe('ManualImage', () => {
  it('renders the image with the correct src', () => {
    render(<ManualImage {...sampleMedia} />)
    expect(screen.getByAltText('Hero image').getAttribute('src')).toBe('/hero.jpg')
  })

  it('renders the image with the correct alt text', () => {
    render(<ManualImage {...sampleMedia} />)
    expect(screen.getByAltText('Hero image')).toBeTruthy()
  })

  it('does not forward mediaType to the DOM', () => {
    render(<ManualImage {...sampleMedia} />)
    const img = screen.getByAltText('Hero image')
    expect(img.getAttribute('mediaType')).toBeNull()
    expect(img.getAttribute('mediatype')).toBeNull()
  })

  it('forwards priority when provided', () => {
    render(<ManualImage {...sampleMedia} priority={true} />)
    expect(screen.getByAltText('Hero image').getAttribute('data-priority')).toBe('true')
  })

  it('does not set priority when not provided', () => {
    render(<ManualImage {...sampleMedia} />)
    expect(screen.getByAltText('Hero image').getAttribute('data-priority')).toBeNull()
  })

  it('forwards loading when provided', () => {
    render(<ManualImage {...sampleMedia} loading="eager" />)
    expect(screen.getByAltText('Hero image').getAttribute('loading')).toBe('eager')
  })

  // Regression: ManualImage destructures its props explicitly, and used to
  // accept `fetchPriority` implicitly through ContentMedia and then drop it —
  // so an LCP ManualImage silently rendered at default fetch priority, the one
  // thing next/image v16 no longer derives from `priority` (ADR-0021).
  it('forwards fetchPriority when provided', () => {
    render(<ManualImage {...sampleMedia} fetchPriority="high" />)
    expect(screen.getByAltText('Hero image').getAttribute('fetchpriority')).toBe('high')
  })

  it('forwards className when provided', () => {
    render(<ManualImage {...sampleMedia} className="custom-class" />)
    expect(screen.getByAltText('Hero image').className).toContain('custom-class')
  })

  it('forwards sizes when provided', () => {
    render(<ManualImage {...sampleMedia} sizes="(min-width: 992px) 33vw, 100vw" />)
    expect(screen.getByAltText('Hero image').getAttribute('sizes')).toBe(
      '(min-width: 992px) 33vw, 100vw',
    )
  })

  it('does not set sizes when not provided', () => {
    render(<ManualImage {...sampleMedia} />)
    expect(screen.getByAltText('Hero image').getAttribute('sizes')).toBeNull()
  })

  it('forwards aspectRatio as a CSS variable on the image', () => {
    render(<ManualImage {...sampleMedia} image={{ ...sampleMedia.image, aspectRatio: '16 / 9' }} />)
    const img = screen.getByAltText('Hero image')
    expect(img.getAttribute('style')).toContain('--image-aspect-ratio')
  })
})
