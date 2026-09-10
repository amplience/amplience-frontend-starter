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
  // ArtDirectedMedia (mobile override) uses getImageProps to build <source>/<img>.
  getImageProps: ({
    src,
    alt,
    width,
    height,
    sizes,
    loader,
    priority,
    fetchPriority,
    loading,
  }: {
    src: string
    alt: string
    width: number
    height: number
    sizes?: string
    loader?: (p: { src: string; width: number }) => string
    priority?: boolean
    fetchPriority?: 'auto' | 'high' | 'low'
    loading?: 'eager' | 'lazy'
  }) => ({
    // Real getImageProps returns the loading props on `props` — mirror that so
    // the art-directed path's tier handling is assertable (ADR-0021).
    props: {
      src: loader ? loader({ src, width }) : src,
      srcSet: `${loader ? loader({ src, width }) : src} ${width}w`,
      sizes,
      width,
      height,
      alt,
      ...(priority !== undefined && { 'data-priority': priority ? 'true' : undefined }),
      ...(fetchPriority !== undefined && { fetchPriority }),
      ...(loading !== undefined && { loading }),
    },
  }),
}))

afterEach(cleanup)

const sampleMedia = {
  mediaType: 'ManualImage' as const,
  image: {
    src: '/hero.jpg',
    alt: 'Hero image',
    width: 1200,
    height: 600,
  },
}

describe('HeroBlock', () => {
  describe('structure', () => {
    it('renders a <section> element', () => {
      render(<HeroBlock title="Hello" />)
      expect(screen.getByRole('region').tagName).toBe('SECTION')
    })

    it('renders the title as an h1', () => {
      render(<HeroBlock title="Welcome to Amplience Frontend Starter" />)
      expect(
        screen.getByRole('heading', { level: 1, name: 'Welcome to Amplience Frontend Starter' }),
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

  describe('bare (nested in a layout container)', () => {
    // CSS module class names are empty strings in the test environment, so the
    // assertions here are about which *element* wraps the content, not styling.
    // `Container` is identifiable by its own literal class hook.

    it('wraps content in a Container by default', () => {
      const { container } = render(<HeroBlock title="Title" />)
      expect(container.querySelector('.Container')).toBeTruthy()
    })

    it('drops the Container when bare, so the parent gutter is not compounded', () => {
      const { container } = render(<HeroBlock title="Title" bare />)
      expect(container.querySelector('.Container')).toBeNull()
    })

    it('keeps the section and its layout attributes when bare', () => {
      // The hero's whole layout — overlay mode, scrim, content positioning —
      // is expressed on the section, so bare strips the container and nothing
      // else.
      render(<HeroBlock title="Title" bare media={sampleMedia} />)
      const section = screen.getByRole('region')
      expect(section.tagName).toBe('SECTION')
      expect(section.getAttribute('data-content-position-desktop')).toBe('overlay')
      expect(section.className).toContain('HeroBlock')
    })

    it('still renders the title, CTAs and image when bare', () => {
      render(
        <HeroBlock title="Title" bare media={sampleMedia} ctas={[{ label: 'Go', href: '/go' }]} />,
      )
      expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Go' })).toBeTruthy()
      expect(screen.getByRole('img')).toBeTruthy()
    })

    it('forwards additional class names when bare', () => {
      render(<HeroBlock title="Title" bare className="custom" />)
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
      render(<HeroBlock title="Title" media={sampleMedia} />)
      expect(screen.getByAltText('Hero image')).toBeTruthy()
    })

    it('does not render image element when omitted', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.queryByRole('img')).toBeNull()
    })
  })

  describe('mobile override (art direction)', () => {
    const mobileSample = {
      mediaType: 'ManualImage' as const,
      image: { src: '/hero-mobile.jpg', alt: 'Mobile hero', width: 600, height: 1200 },
    }

    it('renders a <picture> with a mobile <source> when mobileOverride and mobileMedia are set', () => {
      const { container } = render(
        <HeroBlock title="Title" media={sampleMedia} mobileOverride mobileMedia={mobileSample} />,
      )
      expect(container.querySelector('picture')).not.toBeNull()
      expect(container.querySelector('source')?.getAttribute('media')).toBe('(max-width: 768px)')
    })

    it('does not art-direct when mobileOverride is false', () => {
      const { container } = render(
        <HeroBlock title="Title" media={sampleMedia} mobileMedia={mobileSample} />,
      )
      expect(container.querySelector('picture')).toBeNull()
    })

    it('does not art-direct when mobileMedia is absent', () => {
      const { container } = render(<HeroBlock title="Title" media={sampleMedia} mobileOverride />)
      expect(container.querySelector('picture')).toBeNull()
    })

    it('reserves a separate mobile aspect ratio in flexible overlay', () => {
      render(
        <HeroBlock title="Title" media={sampleMedia} mobileOverride mobileMedia={mobileSample} />,
      )
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--media-aspect-ratio: 1200 / 600')
      expect(style).toContain('--media-aspect-ratio-mobile: 600 / 1200')
    })
  })

  describe('image loading priority (ADR-0021)', () => {
    const img = () => screen.getByAltText('Hero image')

    it('leaves the image lazy by default (next/image lazy-loads)', () => {
      render(<HeroBlock title="Title" media={sampleMedia} />)
      expect(img().getAttribute('data-priority')).toBeNull()
      expect(img().getAttribute('loading')).toBeNull()
    })

    it('prioritises the image when the hero is the LCP candidate', () => {
      render(<HeroBlock title="Title" media={sampleMedia} loadPriority="lcp" />)
      expect(img().getAttribute('data-priority')).toBe('true')
      expect(img().getAttribute('fetchpriority')).toBe('high')
    })

    // The middle tier: eager so an above-the-fold hero isn't discovered late,
    // but no preload or priority bump competing with the real LCP element.
    it('loads the image eagerly, without prioritising it, one step down', () => {
      render(<HeroBlock title="Title" media={sampleMedia} loadPriority="eager" />)
      expect(img().getAttribute('loading')).toBe('eager')
      expect(img().getAttribute('data-priority')).toBeNull()
      expect(img().getAttribute('fetchpriority')).toBeNull()
    })

    it('carries the tier through the art-directed path too', () => {
      const mobile = {
        mediaType: 'ManualImage' as const,
        image: { src: '/hero-mobile.jpg', alt: 'Mobile hero', width: 600, height: 1200 },
      }
      const { rerender } = render(
        <HeroBlock
          title="Title"
          media={sampleMedia}
          mobileOverride
          mobileMedia={mobile}
          loadPriority="lcp"
        />,
      )
      expect(img().getAttribute('data-priority')).toBe('true')

      rerender(
        <HeroBlock
          title="Title"
          media={sampleMedia}
          mobileOverride
          mobileMedia={mobile}
          loadPriority="eager"
        />,
      )
      expect(img().getAttribute('loading')).toBe('eager')
      expect(img().getAttribute('data-priority')).toBeNull()
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
      render(<HeroBlock title="Title" media={sampleMedia} contentPositionMobile="beneath" />)
      expect(screen.getByRole('region').getAttribute('data-content-position-mobile')).toBe(
        'beneath',
      )
    })

    it('sets data-content-position-desktop from prop', () => {
      render(<HeroBlock title="Title" media={sampleMedia} contentPositionDesktop="beneath" />)
      expect(screen.getByRole('region').getAttribute('data-content-position-desktop')).toBe(
        'beneath',
      )
    })

    it('defaults content positions to overlay when image is present', () => {
      render(<HeroBlock title="Title" media={sampleMedia} />)
      const section = screen.getByRole('region')
      expect(section.getAttribute('data-content-position-mobile')).toBe('overlay')
      expect(section.getAttribute('data-content-position-desktop')).toBe('overlay')
    })

    it('sets data-height-behaviour from prop', () => {
      render(<HeroBlock title="Title" media={sampleMedia} heightBehaviour="fitToImage" />)
      expect(screen.getByRole('region').getAttribute('data-height-behaviour')).toBe('fitToImage')
    })

    it('defaults height-behaviour to flexible when image is present', () => {
      render(<HeroBlock title="Title" media={sampleMedia} />)
      expect(screen.getByRole('region').getAttribute('data-height-behaviour')).toBe('flexible')
    })

    it('sets --media-aspect-ratio inline style for flexible overlay', () => {
      render(<HeroBlock title="Title" media={sampleMedia} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--media-aspect-ratio: 1200 / 600')
    })

    it('does not set --media-aspect-ratio for fitToContent', () => {
      render(<HeroBlock title="Title" media={sampleMedia} heightBehaviour="fitToContent" />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).not.toContain('--media-aspect-ratio')
    })

    it('uses the extension-written aspectRatio for a DynamicImage in flexible overlay', () => {
      const dynamicMedia = {
        mediaType: 'DynamicImage' as const,
        image: {
          image: {
            name: 'hero-image',
            endpoint: 'my-store',
            defaultHost: 'cdn.media.amplience.net',
          },
          width: 1200,
          height: 896,
          aspectRatio: 1.3393,
        },
      }
      render(<HeroBlock title="Title" media={dynamicMedia} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--media-aspect-ratio: 1.3393')
    })

    it('falls back to delivered width / height when aspectRatio is absent', () => {
      const dynamicMedia = {
        mediaType: 'DynamicImage' as const,
        image: {
          image: {
            name: 'hero-image',
            endpoint: 'my-store',
            defaultHost: 'cdn.media.amplience.net',
          },
          width: 1136,
          height: 658,
        },
      }
      render(<HeroBlock title="Title" media={dynamicMedia} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--media-aspect-ratio: 1136 / 658')
    })

    it('sets no --media-aspect-ratio when the ratio is unresolvable (no guessed default)', () => {
      const dynamicMedia = {
        mediaType: 'DynamicImage' as const,
        image: {
          image: {
            name: 'hero-image',
            endpoint: 'my-store',
            defaultHost: 'cdn.media.amplience.net',
          },
        },
      }
      render(<HeroBlock title="Title" media={dynamicMedia} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).not.toContain('--media-aspect-ratio')
    })

    it('supports differing mobile and desktop positions', () => {
      render(
        <HeroBlock
          title="Title"
          media={sampleMedia}
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
      render(<HeroBlock title="Title" media={sampleMedia} />)
      expect(screen.getByRole('region').getAttribute('data-overlay-style')).toBe('gradient')
    })

    it('forwards overlayStyle as data attribute', () => {
      render(<HeroBlock title="Title" media={sampleMedia} overlayStyle="solid" />)
      expect(screen.getByRole('region').getAttribute('data-overlay-style')).toBe('solid')
    })

    it('does not set data-overlay-style when image is omitted', () => {
      render(<HeroBlock title="Title" />)
      expect(screen.getByRole('region').getAttribute('data-overlay-style')).toBeNull()
    })

    it('sets --hero-scrim-opacity inline style when image is present', () => {
      render(<HeroBlock title="Title" media={sampleMedia} overlayIntensity={60} />)
      const style = screen.getByRole('region').getAttribute('style') ?? ''
      expect(style).toContain('--hero-scrim-opacity: 0.6')
    })

    it('sets --hero-scrim-opacity to 0 by default', () => {
      render(<HeroBlock title="Title" media={sampleMedia} />)
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
      render(<HeroBlock title="Title" media={sampleMedia} textColor="dark" />)
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
      render(<HeroBlock title="Title" media={sampleMedia} overlayColor="primary" />)
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
