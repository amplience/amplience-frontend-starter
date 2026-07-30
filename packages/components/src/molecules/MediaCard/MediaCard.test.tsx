// @vitest-environment jsdom
//
// Smoke tests for the MediaCard molecule (QL-70).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MediaCard } from './MediaCard'

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

const sampleMedia = {
  mediaType: 'ManualImage' as const,
  image: {
    src: '/product.jpg',
    alt: 'A product photo',
    width: 800,
    height: 450,
  },
}

describe('MediaCard', () => {
  describe('media sizes hint', () => {
    const slot = '(min-width: 992px) 33.34vw, 100vw'

    it('sets no sizes when no slot-width hint is given (next/image 100vw default)', () => {
      render(<MediaCard title="Title" media={sampleMedia} />)
      expect(screen.getByAltText('A product photo').getAttribute('sizes')).toBeNull()
    })

    it('passes the slot-width hint through unchanged for a full-width (above) layout', () => {
      render(<MediaCard title="Title" media={sampleMedia} sizes={slot} />)
      expect(screen.getByAltText('A product photo').getAttribute('sizes')).toBe(slot)
    })

    it('passes the slot-width hint through unchanged for an overlay layout', () => {
      render(<MediaCard title="Title" media={sampleMedia} sizes={slot} layout="overlay" />)
      expect(screen.getByAltText('A product photo').getAttribute('sizes')).toBe(slot)
    })

    it('halves the hint for a beside layout (image is half the card)', () => {
      render(<MediaCard title="Title" media={sampleMedia} sizes={slot} layout="beside" />)
      expect(screen.getByAltText('A product photo').getAttribute('sizes')).toBe(
        '(min-width: 992px) 16.67vw, 50vw',
      )
    })

    it('keeps the full-width hint for a dynamic layout (container query, safe upper bound)', () => {
      render(<MediaCard title="Title" media={sampleMedia} sizes={slot} layout="dynamic" />)
      expect(screen.getByAltText('A product photo').getAttribute('sizes')).toBe(slot)
    })
  })

  describe('structure', () => {
    it('renders the title', () => {
      render(<MediaCard title="Spring collection" />)
      expect(screen.getByText('Spring collection')).toBeTruthy()
    })

    it('renders the title as h3 by default', () => {
      render(<MediaCard title="Spring collection" />)
      expect(screen.getByRole('heading', { level: 3, name: 'Spring collection' })).toBeTruthy()
    })

    it('renders the title at the specified heading level', () => {
      render(<MediaCard title="Spring collection" headingVariant="h2" />)
      expect(screen.getByRole('heading', { level: 2, name: 'Spring collection' })).toBeTruthy()
    })

    it('renders description when provided', () => {
      render(<MediaCard title="Title" description="Body copy" />)
      expect(screen.getByText('Body copy')).toBeTruthy()
    })

    it('does not render description when omitted', () => {
      render(<MediaCard title="Title" />)
      expect(screen.queryByText('Body copy')).toBeNull()
    })

    it('forwards className to the card root', () => {
      const { container } = render(<MediaCard title="Title" className="custom" />)
      expect(container.firstChild?.firstChild).toBeTruthy()
      // className is applied to Card's div — check the outermost rendered div
      expect(container.querySelector('.custom')).toBeTruthy()
    })
  })

  describe('image', () => {
    it('renders the image when provided', () => {
      render(<MediaCard title="Title" media={sampleMedia} />)
      expect(screen.getByAltText('A product photo')).toBeTruthy()
    })

    it('does not render an image element when omitted', () => {
      render(<MediaCard title="Title" />)
      expect(screen.queryByRole('img')).toBeNull()
    })
  })

  describe('layout', () => {
    it('defaults to above layout', () => {
      const { container } = render(<MediaCard title="Title" />)
      const inner = container.querySelector('[data-layout]')
      expect(inner?.getAttribute('data-layout')).toBe('above')
    })

    it('sets data-layout from prop', () => {
      const { container } = render(<MediaCard title="Title" layout="overlay" />)
      expect(container.querySelector('[data-layout]')?.getAttribute('data-layout')).toBe('overlay')
    })

    it('passes beside layout', () => {
      const { container } = render(<MediaCard title="Title" layout="beside" />)
      expect(container.querySelector('[data-layout]')?.getAttribute('data-layout')).toBe('beside')
    })

    it('passes dynamic layout', () => {
      const { container } = render(<MediaCard title="Title" layout="dynamic" />)
      expect(container.querySelector('[data-layout]')?.getAttribute('data-layout')).toBe('dynamic')
    })
  })

  describe('linking', () => {
    it('wraps content in a link when links.href is provided', () => {
      render(<MediaCard title="Title" links={{ href: '/products' }} />)
      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/products')
    })

    it('does not render a link when links is omitted', () => {
      render(<MediaCard title="Title" />)
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('renders external links with target="_blank"', () => {
      render(<MediaCard title="Title" links={{ href: 'https://example.com' }} />)
      expect(screen.getByRole('link').getAttribute('target')).toBe('_blank')
    })
  })

  describe('CTA', () => {
    it('renders a CTA button when links.cta is provided and links.href is absent', () => {
      render(<MediaCard title="Title" links={{ cta: { label: 'Shop now', href: '/shop' } }} />)
      const link = screen.getByRole('link', { name: 'Shop now' })
      expect(link.getAttribute('href')).toBe('/shop')
    })

    it('does not render a CTA when links.href is also set', () => {
      render(
        <MediaCard
          title="Title"
          links={{ href: '/products', cta: { label: 'Shop now', href: '/shop' } }}
        />,
      )
      // Only the card-level link should exist, not a separate 'Shop now' link
      expect(screen.queryByRole('link', { name: 'Shop now' })).toBeNull()
    })

    it('does not leak localeBasePath to the DOM when the CTA is inert', () => {
      render(
        <MediaCard
          title="Title"
          localeBasePath="/fr-fr"
          links={{ href: '/products', cta: { label: 'Shop now', href: '/shop' } }}
        />,
      )
      expect(screen.getByText('Shop now').hasAttribute('localebasepath')).toBe(false)
    })

    it('does not render a CTA when cta is omitted', () => {
      render(<MediaCard title="Title" />)
      expect(screen.queryByRole('link')).toBeNull()
    })
  })
})
