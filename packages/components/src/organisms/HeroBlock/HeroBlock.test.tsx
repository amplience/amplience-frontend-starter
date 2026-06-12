// @vitest-environment jsdom
//
// Smoke tests for the Hero molecule (QL-29).
// next/link and next/image are mocked — same pattern as other atom tests.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HeroBlock } from './HeroBlock'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  // `priority` is a next/image prop, not a DOM attribute — surface it as
  // data-priority so tests can assert on it.
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

const sampleImage = { src: '/hero.jpg', alt: 'Hero image', width: 1200, height: 600 } as const

describe('HeroBlock', () => {
  describe('structure', () => {
    it('renders a <section> element', () => {
      render(<HeroBlock title="Hello" />)
      expect(screen.getByRole('region').tagName).toBe('SECTION')
    })

    it('renders the title as an h1', () => {
      render(<HeroBlock title="Welcome to Quadratic Lite" />)
      expect(
        screen.getByRole('heading', { level: 1, name: 'Welcome to Quadratic Lite' }),
      ).toBeTruthy()
    })

    it('renders subtitle when provided', () => {
      render(<HeroBlock title="Title" subtitle="Supporting copy" />)
      expect(screen.getByText('Supporting copy')).toBeTruthy()
    })

    it('does not render subtitle when omitted', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.queryByText('Supporting copy')).toBeNull()
    })

    it('forwards additional class names', () => {
      render(<HeroBlock title="Title" className="custom" />)
      expect(screen.getByRole('region').className).toContain('custom')
    })
  })

  describe('height constraints', () => {
    it('sets --hero-min-height when minHeight is provided', () => {
      render(<HeroBlock title="Title" minHeight={320} />)
      const el = screen.getByRole('region')
      expect(el.style.getPropertyValue('--hero-min-height')).toBe('320px')
    })

    it('sets --hero-max-height and the data-max-height gate when maxHeight is provided', () => {
      render(<HeroBlock title="Title" maxHeight={480} />)
      const el = screen.getByRole('region')
      expect(el.style.getPropertyValue('--hero-max-height')).toBe('480px')
      expect(el.getAttribute('data-max-height')).toBe('true')
    })

    it('sets neither variable nor gate when the props are omitted', () => {
      render(<HeroBlock title="Title" />)
      const el = screen.getByRole('region')
      expect(el.style.getPropertyValue('--hero-min-height')).toBe('')
      expect(el.style.getPropertyValue('--hero-max-height')).toBe('')
      expect(el.getAttribute('data-max-height')).toBeNull()
    })
  })

  describe('CTAs', () => {
    it('renders a single CTA link', () => {
      render(<HeroBlock title="Title" ctas={[{ label: 'Get started', href: '/docs' }]} />)
      const link = screen.getByRole('link', { name: 'Get started' })
      expect(link.getAttribute('href')).toBe('/docs')
    })

    it('renders multiple CTA links', () => {
      render(
        <HeroBlock
          title="Title"
          ctas={[
            { label: 'Primary', href: '/primary' },
            { label: 'Secondary', href: '/secondary' },
          ]}
        />,
      )
      expect(screen.getByRole('link', { name: 'Primary' })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Secondary' })).toBeTruthy()
    })

    it('does not render CTA section when ctas are omitted', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('does not render CTA section when ctas is an empty array', () => {
      render(<HeroBlock title="Title" ctas={[]} />)
      expect(screen.queryByRole('link')).toBeNull()
    })
  })

  describe('image', () => {
    it('renders image when provided', () => {
      render(<HeroBlock title="Title" image={sampleImage} />)
      expect(screen.getByAltText('Hero image')).toBeTruthy()
    })

    it('does not render image element when omitted', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.queryByRole('img')).toBeNull()
    })
  })

  describe('image loading priority', () => {
    it('does not prioritise the image by default (next/image lazy-loads)', () => {
      render(<HeroBlock title="Title" image={sampleImage} />)
      expect(screen.getByAltText('Hero image').getAttribute('data-priority')).toBeNull()
    })

    it('prioritises the image at the top of the page', () => {
      render(<HeroBlock title="Title" image={sampleImage} isTopOfPage />)
      expect(screen.getByAltText('Hero image').getAttribute('data-priority')).toBe('true')
    })

    it('lets an authored image.priority override the position default', () => {
      render(<HeroBlock title="Title" image={{ ...sampleImage, priority: true }} />)
      expect(screen.getByAltText('Hero image').getAttribute('data-priority')).toBe('true')
    })
  })

  describe('data attributes', () => {
    it('does not set content-position or height-behaviour when image is omitted', () => {
      render(<HeroBlock title="Title" />)
      const section = screen.getByRole('region')
      expect(section.getAttribute('data-content-position-mobile')).toBeNull()
      expect(section.getAttribute('data-content-position-desktop')).toBeNull()
      expect(section.getAttribute('data-height-behaviour')).toBeNull()
    })

    it('sets data-content-position-mobile from prop', () => {
      render(<HeroBlock title="Title" image={sampleImage} contentPositionMobile="beneath" />)
      expect(screen.getByRole('region').getAttribute('data-content-position-mobile')).toBe(
        'beneath',
      )
    })

    it('sets data-content-position-desktop from prop', () => {
      render(<HeroBlock title="Title" image={sampleImage} contentPositionDesktop="beneath" />)
      expect(screen.getByRole('region').getAttribute('data-content-position-desktop')).toBe(
        'beneath',
      )
    })

    it('defaults content positions to overlay when image is present', () => {
      render(<HeroBlock title="Title" image={sampleImage} />)
      const section = screen.getByRole('region')
      expect(section.getAttribute('data-content-position-mobile')).toBe('overlay')
      expect(section.getAttribute('data-content-position-desktop')).toBe('overlay')
    })

    it('sets data-height-behaviour from prop', () => {
      render(<HeroBlock title="Title" image={sampleImage} heightBehaviour="fitToImage" />)
      expect(screen.getByRole('region').getAttribute('data-height-behaviour')).toBe('fitToImage')
    })

    it('defaults height-behaviour to flexible when image is present', () => {
      render(<HeroBlock title="Title" image={sampleImage} />)
      expect(screen.getByRole('region').getAttribute('data-height-behaviour')).toBe('flexible')
    })

    it('sets --image-aspect-ratio inline style for flexible overlay', () => {
      render(<HeroBlock title="Title" image={sampleImage} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--image-aspect-ratio: 1200 / 600')
    })

    it('does not set --image-aspect-ratio for fitToContent', () => {
      render(<HeroBlock title="Title" image={sampleImage} heightBehaviour="fitToContent" />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).not.toContain('--image-aspect-ratio')
    })

    it('supports differing mobile and desktop positions', () => {
      render(
        <HeroBlock
          title="Title"
          image={sampleImage}
          contentPositionMobile="beneath"
          contentPositionDesktop="overlay"
        />,
      )
      const section = screen.getByRole('region')
      expect(section.getAttribute('data-content-position-mobile')).toBe('beneath')
      expect(section.getAttribute('data-content-position-desktop')).toBe('overlay')
    })
  })

  describe('overlay and background', () => {
    it('sets data-overlay-style when image is present', () => {
      render(<HeroBlock title="Title" image={sampleImage} />)
      expect(screen.getByRole('region').getAttribute('data-overlay-style')).toBe('gradient')
    })

    it('forwards overlayStyle as data attribute', () => {
      render(<HeroBlock title="Title" image={sampleImage} overlayStyle="solid" />)
      expect(screen.getByRole('region').getAttribute('data-overlay-style')).toBe('solid')
    })

    it('does not set data-overlay-style when image is omitted', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.getByRole('region').getAttribute('data-overlay-style')).toBeNull()
    })

    it('sets --hero-scrim-opacity inline style when image is present', () => {
      render(<HeroBlock title="Title" image={sampleImage} overlayIntensity={60} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--hero-scrim-opacity: 0.6')
    })

    it('sets --hero-scrim-opacity to 0 by default', () => {
      render(<HeroBlock title="Title" image={sampleImage} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--hero-scrim-opacity: 0')
    })

    it('does not set --hero-scrim-opacity when image is omitted', () => {
      render(<HeroBlock title="Title" />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).not.toContain('--hero-scrim-opacity')
    })

    it('sets data-text-color when provided', () => {
      render(<HeroBlock title="Title" textColor="white" />)
      expect(screen.getByRole('region').getAttribute('data-text-color')).toBe('white')
    })

    it('does not set data-text-color when omitted', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.getByRole('region').getAttribute('data-text-color')).toBeNull()
    })

    it('sets data-text-color with or without an image', () => {
      render(<HeroBlock title="Title" image={sampleImage} textColor="dark" />)
      expect(screen.getByRole('region').getAttribute('data-text-color')).toBe('dark')
    })

    it('sets data-background-color when provided', () => {
      render(<HeroBlock title="Title" backgroundColor="dark" />)
      expect(screen.getByRole('region').getAttribute('data-background-color')).toBe('dark')
    })

    it('sets data-background-color even without an image', () => {
      render(<HeroBlock title="Title" backgroundColor="primary" />)
      expect(screen.getByRole('region').getAttribute('data-background-color')).toBe('primary')
    })

    it('sets data-overlay-color when image is present', () => {
      render(<HeroBlock title="Title" image={sampleImage} overlayColor="primary" />)
      expect(screen.getByRole('region').getAttribute('data-overlay-color')).toBe('primary')
    })

    it('does not set data-overlay-color when image is omitted', () => {
      render(<HeroBlock title="Title" overlayColor="primary" />)
      expect(screen.getByRole('region').getAttribute('data-overlay-color')).toBeNull()
    })
  })

  describe('content positioning', () => {
    it('defaults data-vertical-position to top', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.getByRole('region').getAttribute('data-vertical-position')).toBe('top')
    })

    it('forwards verticalPosition as data attribute', () => {
      render(<HeroBlock title="Title" verticalPosition="bottom" />)
      expect(screen.getByRole('region').getAttribute('data-vertical-position')).toBe('bottom')
    })

    it('defaults data-horizontal-position to left', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.getByRole('region').getAttribute('data-horizontal-position')).toBe('left')
    })

    it('forwards horizontalPosition as data attribute', () => {
      render(<HeroBlock title="Title" horizontalPosition="right" />)
      expect(screen.getByRole('region').getAttribute('data-horizontal-position')).toBe('right')
    })

    it('defaults data-text-align to left', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.getByRole('region').getAttribute('data-text-align')).toBe('left')
    })

    it('forwards textAlign as data attribute', () => {
      render(<HeroBlock title="Title" textAlign="center" />)
      expect(screen.getByRole('region').getAttribute('data-text-align')).toBe('center')
    })
  })
})
