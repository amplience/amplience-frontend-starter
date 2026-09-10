// @vitest-environment jsdom
//
// Tests for the BlogArticle template.
//
// The focus is the cover image's loading treatment (ADR-0021). An article's
// cover is the first thing on the page and its LCP element in practice, and it
// used to render at next/image's default priority: the route seeded the cue,
// the template had no prop for it, and it fell on the floor between them. These
// tests assert it arrives — a silently-dropped prop is exactly the failure mode
// that made the fix necessary, and nothing about the markup would reveal it.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { BlogArticle } from './BlogArticle'

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

const coverImage: ContentMediaData = {
  mediaType: 'ManualImage',
  image: { src: '/cover.jpg', alt: 'Article cover', width: 1600, height: 900 },
}

describe('BlogArticle', () => {
  describe('structure', () => {
    it('renders the title and the cover image', () => {
      render(<BlogArticle title="On rendering" coverImage={coverImage} />)
      expect(screen.getByText('On rendering')).toBeTruthy()
      expect(screen.getByAltText('Article cover')).toBeTruthy()
    })

    it('renders the body slots passed in as children', () => {
      render(
        <BlogArticle title="On rendering">
          <p>Body block</p>
        </BlogArticle>,
      )
      expect(screen.getByText('Body block')).toBeTruthy()
    })
  })

  describe('cover image loading priority (ADR-0021)', () => {
    const img = () => screen.getByAltText('Article cover')

    it('lazy-loads the cover by default', () => {
      render(<BlogArticle title="On rendering" coverImage={coverImage} />)
      expect(img().getAttribute('data-priority')).toBeNull()
      expect(img().getAttribute('loading')).toBeNull()
    })

    it('forwards the LCP tier to the cover image', () => {
      render(<BlogArticle title="On rendering" coverImage={coverImage} loadPriority="lcp" />)
      expect(img().getAttribute('data-priority')).toBe('true')
      expect(img().getAttribute('fetchpriority')).toBe('high')
    })

    it('forwards the eager tier to the cover image', () => {
      render(<BlogArticle title="On rendering" coverImage={coverImage} loadPriority="eager" />)
      expect(img().getAttribute('loading')).toBe('eager')
      expect(img().getAttribute('data-priority')).toBeNull()
    })
  })
})
