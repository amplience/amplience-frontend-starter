// Tests for the page metadata mapping (QL-36).
//
// Node environment on purpose — pure data mapping, no DOM.

import { describe, expect, it } from 'vitest'

import type { MediaImageLink } from '@amplience/quadratic-content'

import { pageMetadataFromSchema, type PageSchema } from './Page.registry'

const page = (fields: Partial<PageSchema> = {}): PageSchema => ({
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/page' },
  ...fields,
})

const socialImage: MediaImageLink = {
  _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/image-link' },
  id: 'a1b2c3d4-0002-4000-8000-000000000001',
  name: 'ql-home-social-card',
  endpoint: 'quadratic',
  defaultHost: 'cdn.media.amplience.net',
}

describe('pageMetadataFromSchema', () => {
  it('maps title, description, and keywords', () => {
    const metadata = pageMetadataFromSchema(
      page({
        title: 'Welcome',
        description: 'A clean starting point.',
        keywords: ['amplience', 'accelerator'],
      }),
    )
    expect(metadata).toEqual({
      title: 'Welcome',
      description: 'A clean starting point.',
      keywords: ['amplience', 'accelerator'],
    })
  })

  it('omits fields the content does not set, so merging falls back cleanly', () => {
    const metadata = pageMetadataFromSchema(page({ title: 'Welcome' }))
    expect(metadata).toEqual({ title: 'Welcome' })
    expect('description' in metadata).toBe(false)
    expect('keywords' in metadata).toBe(false)
  })

  it('omits keywords when the list is empty', () => {
    const metadata = pageMetadataFromSchema(page({ keywords: [] }))
    expect('keywords' in metadata).toBe(false)
  })

  it('returns a fresh keywords array, not a reference to the content', () => {
    const keywords = ['amplience']
    const metadata = pageMetadataFromSchema(page({ keywords }))
    expect(metadata.keywords).not.toBe(keywords)
    expect(metadata.keywords).toEqual(keywords)
  })
})

describe('pageMetadataFromSchema — social card', () => {
  it('maps the social group to openGraph, building the media URL', () => {
    const metadata = pageMetadataFromSchema(
      page({
        social: { title: 'Social title', description: 'Social blurb', image: socialImage },
      }),
    )
    expect(metadata.openGraph).toEqual({
      title: 'Social title',
      description: 'Social blurb',
      images: ['https://cdn.media.amplience.net/i/quadratic/ql-home-social-card'],
    })
  })

  it('accepts a plain { src } social image and passes the URL through', () => {
    const metadata = pageMetadataFromSchema(
      page({ social: { image: { src: 'https://picsum.photos/seed/ql-hero/1200/600' } } }),
    )
    expect(metadata.openGraph?.images).toEqual(['https://picsum.photos/seed/ql-hero/1200/600'])
  })

  it('falls back to the page title/description for unset social fields', () => {
    const metadata = pageMetadataFromSchema(
      page({ title: 'Page title', description: 'Page blurb', social: { image: socialImage } }),
    )
    expect(metadata.openGraph?.title).toBe('Page title')
    expect(metadata.openGraph?.description).toBe('Page blurb')
  })

  it('omits openGraph entirely when the content has no social group', () => {
    const metadata = pageMetadataFromSchema(page({ title: 'Page title' }))
    expect('openGraph' in metadata).toBe(false)
  })
})

describe('pageMetadataFromSchema — canonical', () => {
  it('defaults the canonical to the route path', () => {
    const metadata = pageMetadataFromSchema(page(), { path: '/products/sofas' })
    expect(metadata.alternates).toEqual({ canonical: '/products/sofas' })
  })

  it('prefers a custom canonicalUrl from the content', () => {
    const metadata = pageMetadataFromSchema(page({ canonicalUrl: 'https://example.com/sofas' }), {
      path: '/products/sofas',
    })
    expect(metadata.alternates).toEqual({ canonical: 'https://example.com/sofas' })
  })

  it('omits the canonical when neither content nor route provides one', () => {
    const metadata = pageMetadataFromSchema(page())
    expect('alternates' in metadata).toBe(false)
  })
})

describe('pageMetadataFromSchema — robots', () => {
  it('maps noindex/nofollow to index/follow', () => {
    const metadata = pageMetadataFromSchema(page({ robots: { noindex: true, nofollow: true } }))
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('treats unset flags within the group as permissive', () => {
    const metadata = pageMetadataFromSchema(page({ robots: { noindex: true } }))
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })

  it('omits robots entirely when the content has no robots group', () => {
    const metadata = pageMetadataFromSchema(page())
    expect('robots' in metadata).toBe(false)
  })
})
