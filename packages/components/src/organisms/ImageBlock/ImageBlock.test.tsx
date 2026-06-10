// @vitest-environment jsdom
//
// Smoke tests for the ImageBlock molecule.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImageBlock } from './ImageBlock'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: React.ComponentPropsWithoutRef<'img'>) => (
    <img src={src} alt={alt} {...props} />
  ),
}))

afterEach(cleanup)

const sampleImage = {
  src: '/photo.jpg',
  alt: 'A test photo',
  width: 1200,
  height: 800,
} as const

describe('ImageBlock', () => {
  describe('structure', () => {
    it('renders a <section> element', () => {
      render(<ImageBlock image={sampleImage} />)
      expect(screen.getByRole('region').tagName).toBe('SECTION')
    })

    it('renders a <figure> element', () => {
      render(<ImageBlock image={sampleImage} />)
      expect(document.querySelector('figure')).toBeTruthy()
    })

    it('renders the image with the correct alt text', () => {
      render(<ImageBlock image={sampleImage} />)
      expect(screen.getByAltText('A test photo')).toBeTruthy()
    })

    it('forwards additional class names to the section', () => {
      render(<ImageBlock image={sampleImage} className="custom" />)
      expect(screen.getByRole('region').className).toContain('custom')
    })
  })

  describe('caption', () => {
    it('renders caption when provided', () => {
      render(<ImageBlock image={sampleImage} caption="Photo by Jane" />)
      expect(screen.getByText('Photo by Jane')).toBeTruthy()
    })

    it('renders caption inside a <figcaption>', () => {
      render(<ImageBlock image={sampleImage} caption="Photo by Jane" />)
      expect(document.querySelector('figcaption')).toBeTruthy()
    })

    it('does not render figcaption when caption is omitted', () => {
      render(<ImageBlock image={sampleImage} />)
      expect(document.querySelector('figcaption')).toBeNull()
    })
  })

  describe('link', () => {
    it('wraps image in a link when href is provided', () => {
      render(<ImageBlock image={sampleImage} href="/products" />)
      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/products')
    })

    it('does not render a link when href is omitted', () => {
      render(<ImageBlock image={sampleImage} />)
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('renders an external link with target="_blank"', () => {
      render(<ImageBlock image={sampleImage} href="https://example.com" />)
      const link = screen.getByRole('link')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    })
  })

  describe('data attributes', () => {
    it('does not set data-full-bleed when fullBleed is false (default)', () => {
      render(<ImageBlock image={sampleImage} />)
      expect(screen.getByRole('region').getAttribute('data-full-bleed')).toBeNull()
    })

    it('sets data-full-bleed="true" when fullBleed is true', () => {
      render(<ImageBlock image={sampleImage} fullBleed />)
      expect(screen.getByRole('region').getAttribute('data-full-bleed')).toBe('true')
    })

    it('does not set data-background-color when omitted', () => {
      render(<ImageBlock image={sampleImage} />)
      expect(screen.getByRole('region').getAttribute('data-background-color')).toBeNull()
    })

    it('sets data-background-color when provided', () => {
      render(<ImageBlock image={sampleImage} backgroundColor="dark" />)
      expect(screen.getByRole('region').getAttribute('data-background-color')).toBe('dark')
    })
  })

  describe('image passthrough', () => {
    it('passes src to the image element', () => {
      render(<ImageBlock image={{ ...sampleImage, src: '/custom.jpg' }} />)
      expect(screen.getByAltText('A test photo').getAttribute('src')).toBe('/custom.jpg')
    })

    it('passes aspectRatio as a CSS variable on the image', () => {
      render(<ImageBlock image={{ ...sampleImage, aspectRatio: '16 / 9' }} />)
      const img = screen.getByAltText('A test photo')
      expect(img.getAttribute('style')).toContain('--image-aspect-ratio')
    })
  })
})
