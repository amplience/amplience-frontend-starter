// @vitest-environment jsdom
//
// Tests for the DynamicImage molecule (QL-65).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DynamicImageData } from '@amplience/quadratic-types'

import { DynamicImage } from './DynamicImage'

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    loader,
    sizes,
    priority,
    ...props
  }: {
    src: string
    alt: string
    loader?: (p: { src: string; width: number }) => string
    sizes?: string
    priority?: boolean
    fill?: boolean
  }) => (
    // Call the loader at a representative width so tests can assert on the final URL
    <img
      src={loader ? loader({ src, width: 1200 }) : src}
      alt={alt}
      data-sizes={sizes}
      data-priority={priority ? 'true' : undefined}
      {...props}
    />
  ),
}))

afterEach(cleanup)

const sampleImage: DynamicImageData = {
  mediaType: 'DynamicImage',
  image: {
    image: {
      name: 'hero-image',
      endpoint: 'my-store',
      defaultHost: 'cdn.media.amplience.net',
    },
    query: 'sm=aspect&aspect=16:9',
    aspectRatio: 1.7778,
  },
  imageAltText: 'A hero image',
}

describe('DynamicImage', () => {
  describe('URL construction', () => {
    it('renders an img with the DI base URL + pre-baked query + fmt=webp&w=', () => {
      render(<DynamicImage image={sampleImage} />)
      const img = screen.getByRole('img')
      expect(img.getAttribute('src')).toBe(
        'https://cdn.media.amplience.net/i/my-store/hero-image?sm=aspect&aspect=16:9&fmt=webp&w=1200', // normalised ? added by DynamicImage
      )
    })

    it('uses ? separator when no pre-baked query is present', () => {
      const noQuery: DynamicImageData = {
        mediaType: 'DynamicImage',
        image: {
          image: {
            name: 'plain-image',
            endpoint: 'my-store',
            defaultHost: 'cdn.media.amplience.net',
          },
        },
      }
      // No imageAltText → alt="" → ARIA role is 'presentation', not 'img',
      // so query the DOM directly rather than by role.
      const { container } = render(<DynamicImage image={noQuery} />)
      const img = container.querySelector('img')
      expect(img?.getAttribute('src')).toContain('?fmt=webp&w=')
      expect(img?.getAttribute('src')).not.toContain('&&')
    })

    it('URL-encodes the image name', () => {
      const encoded: DynamicImageData = {
        mediaType: 'DynamicImage',
        image: {
          image: {
            name: 'my image/with spaces',
            endpoint: 'demo',
            defaultHost: 'cdn.media.amplience.net',
          },
        },
      }
      // No imageAltText → alt="" → role 'presentation'; query the DOM directly.
      const { container } = render(<DynamicImage image={encoded} />)
      const src = container.querySelector('img')?.getAttribute('src') ?? ''
      expect(src).toContain('my%20image%2Fwith%20spaces')
    })
  })

  describe('alt text', () => {
    it('sets alt from imageAltText', () => {
      render(<DynamicImage image={sampleImage} />)
      expect(screen.getByAltText('A hero image')).toBeTruthy()
    })

    it('falls back to empty string when imageAltText is absent', () => {
      const noAlt: DynamicImageData = {
        mediaType: 'DynamicImage',
        image: {
          image: {
            name: 'hero-image',
            endpoint: 'my-store',
            defaultHost: 'cdn.media.amplience.net',
          },
        },
      }
      // alt="" is exactly what's being asserted — the empty alt demotes the
      // ARIA role to 'presentation', so getByRole('img') cannot find it.
      const { container } = render(<DynamicImage image={noAlt} />)
      expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
    })
  })

  describe('priority', () => {
    it('sets data-priority="true" when priority={true}', () => {
      render(<DynamicImage image={sampleImage} priority={true} />)
      expect(screen.getByRole('img').getAttribute('data-priority')).toBe('true')
    })

    it('does not set data-priority when priority is not provided', () => {
      render(<DynamicImage image={sampleImage} />)
      expect(screen.getByRole('img').getAttribute('data-priority')).toBeNull()
    })
  })

  describe('sizes', () => {
    it('defaults sizes to "100vw"', () => {
      render(<DynamicImage image={sampleImage} />)
      expect(screen.getByRole('img').getAttribute('data-sizes')).toBe('100vw')
    })

    it('forwards a custom sizes prop', () => {
      render(<DynamicImage image={sampleImage} sizes="(max-width: 480px) 100vw, 360px" />)
      expect(screen.getByRole('img').getAttribute('data-sizes')).toBe(
        '(max-width: 480px) 100vw, 360px',
      )
    })
  })

  describe('aspect ratio (payload-resolved)', () => {
    // The ratio comes from the delivery payload alone (the delivered-image
    // aspectRatio / width / height the di-transform extension wrote at pick
    // time) and is exposed as the --di-aspect-ratio custom property (consumed
    // by .root's `aspect-ratio: var(--di-aspect-ratio, auto)`) so that layout
    // contexts like HeroBlock's flexible grid can override it in CSS —
    // impossible against an inline `aspect-ratio` declaration.
    it('sets --di-aspect-ratio from the extension-written aspectRatio', () => {
      const withRatio: DynamicImageData = {
        mediaType: 'DynamicImage',
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
      const { container } = render(<DynamicImage image={withRatio} />)
      expect(
        (container.firstChild as HTMLElement).style.getPropertyValue('--di-aspect-ratio'),
      ).toBe('1.3393')
    })

    it('falls back to delivered width / height when aspectRatio is absent', () => {
      const dimsOnly: DynamicImageData = {
        mediaType: 'DynamicImage',
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
      const { container } = render(<DynamicImage image={dimsOnly} />)
      expect(
        (container.firstChild as HTMLElement).style.getPropertyValue('--di-aspect-ratio'),
      ).toBe('1136 / 658')
    })

    it('sets no --di-aspect-ratio for legacy payloads with no dimension data (no guessed default)', () => {
      const noLock: DynamicImageData = {
        mediaType: 'DynamicImage',
        image: {
          image: {
            name: 'hero-image',
            endpoint: 'my-store',
            defaultHost: 'cdn.media.amplience.net',
          },
        },
      }
      const { container } = render(<DynamicImage image={noLock} />)
      expect(
        (container.firstChild as HTMLElement).style.getPropertyValue('--di-aspect-ratio'),
      ).toBe('')
    })
  })

  describe('graceful null render', () => {
    it('returns null when image link name is missing', () => {
      const broken: DynamicImageData = {
        mediaType: 'DynamicImage',
        image: {
          image: { name: '', endpoint: 'my-store', defaultHost: 'cdn.media.amplience.net' },
        },
      }
      const { container } = render(<DynamicImage image={broken} />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when endpoint is missing', () => {
      const broken: DynamicImageData = {
        mediaType: 'DynamicImage',
        image: {
          image: { name: 'img', endpoint: '', defaultHost: 'cdn.media.amplience.net' },
        },
      }
      const { container } = render(<DynamicImage image={broken} />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when defaultHost is missing', () => {
      const broken: DynamicImageData = {
        mediaType: 'DynamicImage',
        image: {
          image: { name: 'img', endpoint: 'my-store', defaultHost: '' },
        },
      }
      const { container } = render(<DynamicImage image={broken} />)
      expect(container.firstChild).toBeNull()
    })
  })
})
