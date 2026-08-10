// @vitest-environment jsdom
//
// Smoke tests for the MediaBlock organism (QL-65).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContentMediaData } from '@amplience/quadratic-types'

import { MediaBlock } from './MediaBlock'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

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

const sampleMedia: ContentMediaData = {
  mediaType: 'ManualImage',
  image: {
    src: '/photo.jpg',
    alt: 'A test photo',
    width: 1200,
    height: 800,
  },
}

describe('MediaBlock', () => {
  describe('structure', () => {
    it('renders a <section> element', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(screen.getByRole('region').tagName).toBe('SECTION')
    })

    it('renders a <figure> element', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(document.querySelector('figure')).toBeTruthy()
    })

    it('renders the image with the correct alt text', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(screen.getByAltText('A test photo')).toBeTruthy()
    })

    it('forwards additional class names to the section', () => {
      render(<MediaBlock media={sampleMedia} className="custom" />)
      expect(screen.getByRole('region').className).toContain('custom')
    })
  })

  describe('caption', () => {
    it('renders caption when provided', () => {
      render(<MediaBlock media={sampleMedia} caption="Photo by Jane" />)
      expect(screen.getByText('Photo by Jane')).toBeTruthy()
    })

    it('renders caption inside a <figcaption>', () => {
      render(<MediaBlock media={sampleMedia} caption="Photo by Jane" />)
      expect(document.querySelector('figcaption')).toBeTruthy()
    })

    it('does not render figcaption when caption is omitted', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(document.querySelector('figcaption')).toBeNull()
    })
  })

  describe('link', () => {
    it('wraps media in a link when href is provided', () => {
      render(<MediaBlock media={sampleMedia} href="/products" />)
      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/products')
    })

    it('does not render a link when href is omitted', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('renders an external link with target="_blank"', () => {
      render(<MediaBlock media={sampleMedia} href="https://example.com" />)
      const link = screen.getByRole('link')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    })
  })

  describe('data attributes', () => {
    it('does not set data-full-bleed when fullBleed is false (default)', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(screen.getByRole('region').getAttribute('data-full-bleed')).toBeNull()
    })

    it('sets data-full-bleed="true" when fullBleed is true', () => {
      render(<MediaBlock media={sampleMedia} fullBleed />)
      expect(screen.getByRole('region').getAttribute('data-full-bleed')).toBe('true')
    })

    it('sets data-background-color when provided', () => {
      render(<MediaBlock media={sampleMedia} backgroundColor="dark" />)
      expect(screen.getByRole('region').getAttribute('data-background-color')).toBe('dark')
    })
  })

  describe('image loading priority (ADR-0021)', () => {
    const img = () => screen.getByAltText('A test photo')

    it('leaves the image lazy by default', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(img().getAttribute('data-priority')).toBeNull()
      expect(img().getAttribute('loading')).toBeNull()
    })

    it('prioritises the image when it is the LCP candidate', () => {
      render(<MediaBlock media={sampleMedia} loadPriority="lcp" />)
      expect(img().getAttribute('data-priority')).toBe('true')
      expect(img().getAttribute('fetchpriority')).toBe('high')
    })

    // The middle tier is the point of the graded cue: eager so an
    // above-the-fold image isn't discovered late, but no preload and no
    // priority bump to compete with the real LCP element.
    it('loads the image eagerly, without prioritising it, one step down', () => {
      render(<MediaBlock media={sampleMedia} loadPriority="eager" />)
      expect(img().getAttribute('loading')).toBe('eager')
      expect(img().getAttribute('data-priority')).toBeNull()
      expect(img().getAttribute('fetchpriority')).toBeNull()
    })
  })

  describe('sizes hint', () => {
    it('defaults to 100vw so a standalone block uses width-based srcset', () => {
      render(<MediaBlock media={sampleMedia} />)
      expect(screen.getByAltText('A test photo').getAttribute('sizes')).toBe('100vw')
    })

    it('uses the parent slot width when supplied', () => {
      render(<MediaBlock media={sampleMedia} sizes="(min-width: 769px) 50vw, 100vw" />)
      expect(screen.getByAltText('A test photo').getAttribute('sizes')).toBe(
        '(min-width: 769px) 50vw, 100vw',
      )
    })

    it('forces 100vw when full-bleed, ignoring any slot hint', () => {
      render(<MediaBlock media={sampleMedia} fullBleed sizes="(min-width: 769px) 50vw, 100vw" />)
      expect(screen.getByAltText('A test photo').getAttribute('sizes')).toBe('100vw')
    })
  })
})
