// @vitest-environment jsdom
//
// Tests for the ArtDirectedMedia molecule (hero mobile override).
//
// next/image's getImageProps is mocked to a deterministic shape so we can
// assert the <picture>/<source>/<img> structure and the loader routing
// (ManualImage → default optimiser, DynamicImage → amplienceDiLoader) without
// standing up the Next image config.

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { ArtDirectedMedia } from './ArtDirectedMedia'

vi.mock('next/image', () => ({
  // Echo the inputs back as predictable props. srcSet is derived from the
  // loader (when present) so tests can prove the DI loader was wired in.
  getImageProps: ({
    src,
    alt,
    width,
    height,
    sizes,
    priority,
    loading,
    loader,
  }: {
    src: string
    alt: string
    width: number
    height: number
    sizes?: string
    priority?: boolean
    loading?: 'eager' | 'lazy'
    loader?: (p: { src: string; width: number }) => string
  }) => ({
    props: {
      src: loader ? loader({ src, width }) : src,
      srcSet: `${loader ? loader({ src, width }) : src} ${width}w`,
      sizes,
      width,
      height,
      alt,
      ...(priority ? { loading: 'eager', fetchPriority: 'high' } : {}),
      // An explicit `loading` (the middle tier) reaches the <img> without the
      // fetch-priority bump that `priority` brings.
      ...(loading !== undefined && !priority ? { loading } : {}),
    },
  }),
}))

afterEach(cleanup)

const manualDesktop: ContentMediaData = {
  mediaType: 'ManualImage',
  image: { src: 'https://cdn/desktop.jpg', alt: 'Desktop hero', width: 2752, height: 1536 },
}

const manualMobile: ContentMediaData = {
  mediaType: 'ManualImage',
  image: { src: 'https://cdn/mobile.jpg', alt: 'Mobile hero', width: 2752, height: 1275 },
}

const dynamicMobile: ContentMediaData = {
  mediaType: 'DynamicImage',
  image: {
    image: { name: 'hero-mobile', endpoint: 'my-store', defaultHost: 'cdn.media.amplience.net' },
    query: 'sm=aspect&aspect=9:16',
    aspectRatio: 0.5625,
  },
  imageAltText: 'Dynamic mobile',
}

describe('ArtDirectedMedia', () => {
  it('renders a <picture> with a mobile <source> and a desktop <img>', () => {
    const { container } = render(<ArtDirectedMedia desktop={manualDesktop} mobile={manualMobile} />)
    const picture = container.querySelector('picture')
    const source = container.querySelector('source')
    const img = container.querySelector('img')

    expect(picture).not.toBeNull()
    expect(source).not.toBeNull()
    expect(img).not.toBeNull()
    // Fallback <img> is the desktop asset.
    expect(img?.getAttribute('src')).toBe('https://cdn/desktop.jpg')
    expect(img?.getAttribute('alt')).toBe('Desktop hero')
  })

  it('scopes the mobile source to the default 768px breakpoint with its own dimensions', () => {
    const { container } = render(<ArtDirectedMedia desktop={manualDesktop} mobile={manualMobile} />)
    const source = container.querySelector('source')
    expect(source?.getAttribute('media')).toBe('(max-width: 768px)')
    // The differing mobile ratio (2752x1275) is reserved on the source → no CLS.
    expect(source?.getAttribute('width')).toBe('2752')
    expect(source?.getAttribute('height')).toBe('1275')
  })

  it('honours a custom mobileMaxWidth', () => {
    const { container } = render(
      <ArtDirectedMedia desktop={manualDesktop} mobile={manualMobile} mobileMaxWidth={640} />,
    )
    expect(container.querySelector('source')?.getAttribute('media')).toBe('(max-width: 640px)')
  })

  it('routes a DynamicImage mobile source through the amplience DI loader', () => {
    const { container } = render(
      <ArtDirectedMedia desktop={manualDesktop} mobile={dynamicMobile} />,
    )
    const srcSet = container.querySelector('source')?.getAttribute('srcset') ?? ''
    expect(srcSet).toContain('cdn.media.amplience.net/i/my-store/hero-mobile')
    expect(srcSet).toContain('fmt=webp')
  })

  it('emits per-breakpoint preload links only when priority is set', () => {
    const { container, rerender } = render(
      <ArtDirectedMedia desktop={manualDesktop} mobile={manualMobile} />,
    )
    expect(container.querySelectorAll('link[rel="preload"]')).toHaveLength(0)

    rerender(<ArtDirectedMedia desktop={manualDesktop} mobile={manualMobile} priority />)
    const links = container.querySelectorAll('link[rel="preload"][as="image"]')
    expect(links).toHaveLength(2)
    const medias = Array.from(links).map((l) => l.getAttribute('media'))
    expect(medias).toContain('(max-width: 768px)')
    expect(medias).toContain('(min-width: 769px)')
  })

  // ADR-0021: preloads stay exclusive to the LCP tier. An eager art-directed
  // image loads immediately but must not add two more entries to the preload
  // queue — that is the difference between the two above-the-fold tiers.
  it('loads eagerly without preloading when given loading="eager"', () => {
    const { container } = render(
      <ArtDirectedMedia desktop={manualDesktop} mobile={manualMobile} loading="eager" />,
    )
    expect(container.querySelectorAll('link[rel="preload"]')).toHaveLength(0)
    expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager')
    expect(container.querySelector('img')?.getAttribute('fetchpriority')).toBeNull()
  })

  it('renders nothing when the desktop payload is unresolvable', () => {
    const legacy = { src: '/x.jpg', alt: 'legacy' } as unknown as ContentMediaData
    const { container } = render(<ArtDirectedMedia desktop={legacy} mobile={manualMobile} />)
    expect(container.firstChild).toBeNull()
  })

  it('falls back to the desktop <img> alone when the mobile payload is unresolvable', () => {
    const badMobile = { mediaType: 'ManualImage' } as unknown as ContentMediaData
    const { container } = render(<ArtDirectedMedia desktop={manualDesktop} mobile={badMobile} />)
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('source')).toBeNull()
  })
})
