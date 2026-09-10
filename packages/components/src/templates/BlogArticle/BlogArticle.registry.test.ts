// Tests for the blog-article registry entry — the schema→props adapter, the
// container's getChildren, and `blogArticleMetadataFromSchema`.
//
// The metadata mapper is the substantial part: a route's `generateMetadata`
// returns its result directly, so every conditional spread in it is a `<head>`
// tag that either appears or doesn't. It is also almost entirely branches —
// social-over-article precedence, the og:image fallback chain, canonical
// resolution, robots inversion — which is why an untested version of this file
// accounted for the largest single block of uncovered branches in the repo.

import { describe, expect, it } from 'vitest'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import {
  blogArticleMetadataFromSchema,
  blogArticleRegistryEntry,
  type BlogArticleSchema,
} from './BlogArticle.registry'

const manualImage: ContentMediaData = {
  mediaType: 'ManualImage',
  image: { src: '/cover.jpg', alt: 'Cover', width: 1600, height: 900 },
}

const dynamicImage: ContentMediaData = {
  mediaType: 'DynamicImage',
  image: {
    image: { name: 'cover', endpoint: 'my-store', defaultHost: 'cdn.media.amplience.net' },
    query: 'sm=aspect&aspect=16:9',
  },
  imageAltText: 'Cover',
}

const base: BlogArticleSchema = { _meta: {}, title: 'On rendering' }

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

describe('blogArticleRegistryEntry — propsFromSchema', () => {
  const adapt = blogArticleRegistryEntry.propsFromSchema

  it('passes the editorial fields through and drops the envelope', () => {
    const props = adapt?.(
      {
        ...base,
        coverImage: manualImage,
        author: 'Matt',
        publishDate: '2026-08-10',
        category: 'Engineering',
        tags: ['rendering', 'performance'],
        readTime: 7,
      },
      {},
    )
    expect(props).toMatchObject({
      title: 'On rendering',
      coverImage: manualImage,
      author: 'Matt',
      publishDate: '2026-08-10',
      category: 'Engineering',
      tags: ['rendering', 'performance'],
      readTime: 7,
    })
    expect(props).not.toHaveProperty('_meta')
    expect(props).not.toHaveProperty('slots')
  })

  it('omits absent fields rather than passing undefined through', () => {
    const props = adapt?.(base, {})
    for (const key of ['coverImage', 'author', 'publishDate', 'category', 'tags', 'readTime']) {
      expect(props).not.toHaveProperty(key)
    }
  })

  // ADR-0021: the article's cover image is the LCP element on every article
  // page, so the tier has to survive the trip from the route to the template.
  it('sets loadPriority from the render context, defaulting to lazy', () => {
    expect(adapt?.(base, {})?.loadPriority).toBe('lazy')
    expect(adapt?.(base, { loadPriority: 'lcp' })?.loadPriority).toBe('lcp')
    expect(adapt?.(base, { loadPriority: 'eager' })?.loadPriority).toBe('eager')
  })

  it('declares consumesLoadPriority so its body slots start a step below it', () => {
    expect(blogArticleRegistryEntry.consumesLoadPriority).toBe(true)
  })
})

describe('blogArticleRegistryEntry — getChildren', () => {
  it('returns the article slots', () => {
    const slots = [{ _meta: { schema: 'x' } }]
    expect(blogArticleRegistryEntry.getChildren?.({ ...base, slots })).toEqual(slots)
  })

  it('returns an empty list when the article has no slots', () => {
    expect(blogArticleRegistryEntry.getChildren?.(base)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Metadata mapping
// ---------------------------------------------------------------------------

describe('blogArticleMetadataFromSchema', () => {
  it('maps title, description and keywords when present', () => {
    const meta = blogArticleMetadataFromSchema({
      ...base,
      description: 'How the renderer works',
      keywords: ['rendering', 'next'],
    })
    expect(meta.title).toBe('On rendering')
    expect(meta.description).toBe('How the renderer works')
    expect(meta.keywords).toEqual(['rendering', 'next'])
  })

  it('omits each of them when absent', () => {
    const meta = blogArticleMetadataFromSchema({ _meta: {} })
    expect(meta).not.toHaveProperty('title')
    expect(meta).not.toHaveProperty('description')
    expect(meta).not.toHaveProperty('keywords')
    expect(meta).not.toHaveProperty('openGraph')
    expect(meta).not.toHaveProperty('alternates')
    expect(meta).not.toHaveProperty('robots')
  })

  it('omits an empty keywords array rather than emitting an empty tag', () => {
    expect(blogArticleMetadataFromSchema({ ...base, keywords: [] })).not.toHaveProperty('keywords')
  })

  describe('openGraph', () => {
    it('falls back to the article title and description when social omits them', () => {
      const meta = blogArticleMetadataFromSchema({
        ...base,
        description: 'Article description',
        social: {},
      })
      expect(meta.openGraph).toMatchObject({
        title: 'On rendering',
        description: 'Article description',
      })
    })

    it('prefers the social title and description over the article ones', () => {
      const meta = blogArticleMetadataFromSchema({
        ...base,
        description: 'Article description',
        social: { title: 'Social title', description: 'Social description' },
      })
      expect(meta.openGraph).toMatchObject({
        title: 'Social title',
        description: 'Social description',
      })
    })

    it('uses the cover image as the og:image when social has none', () => {
      const meta = blogArticleMetadataFromSchema({ ...base, coverImage: manualImage })
      expect(meta.openGraph?.images).toEqual(['/cover.jpg'])
    })

    it('prefers the social image over the cover image', () => {
      const meta = blogArticleMetadataFromSchema({
        ...base,
        coverImage: manualImage,
        social: { image: dynamicImage },
      })
      // DI URL, capped at the Open Graph recommended 1200px width.
      expect(meta.openGraph?.images?.[0]).toContain('cdn.media.amplience.net/i/my-store/cover')
      expect(meta.openGraph?.images?.[0]).toContain('w=1200')
    })

    it('emits an openGraph block without images when neither image resolves', () => {
      const unresolvable = {
        mediaType: 'DynamicImage',
        image: { image: { name: '', endpoint: '', defaultHost: '' } },
      } as unknown as ContentMediaData
      const meta = blogArticleMetadataFromSchema({ ...base, coverImage: unresolvable })
      expect(meta.openGraph).toBeDefined()
      expect(meta.openGraph).not.toHaveProperty('images')
    })

    it('emits no openGraph block when there is neither social data nor a cover image', () => {
      expect(blogArticleMetadataFromSchema(base)).not.toHaveProperty('openGraph')
    })
  })

  describe('canonical', () => {
    it('uses an explicit canonicalUrl', () => {
      const meta = blogArticleMetadataFromSchema({ ...base, canonicalUrl: '/blog/on-rendering' })
      expect(meta.alternates).toEqual({ canonical: '/blog/on-rendering' })
    })

    it('falls back to the route path when no canonicalUrl is authored', () => {
      const meta = blogArticleMetadataFromSchema(base, { path: '/blog/on-rendering' })
      expect(meta.alternates).toEqual({ canonical: '/blog/on-rendering' })
    })

    it('prefers the authored canonicalUrl over the route path', () => {
      const meta = blogArticleMetadataFromSchema(
        { ...base, canonicalUrl: '/authored' },
        { path: '/route' },
      )
      expect(meta.alternates).toEqual({ canonical: '/authored' })
    })
  })

  describe('robots', () => {
    // The schema authors the negative (noindex/nofollow); Next's Metadata takes
    // the positive (index/follow). An inversion bug here silently deindexes.
    it('inverts noindex/nofollow into index/follow', () => {
      const meta = blogArticleMetadataFromSchema({
        ...base,
        robots: { noindex: true, nofollow: true },
      })
      expect(meta.robots).toEqual({ index: false, follow: false })
    })

    it('defaults an unset flag to indexable and followable', () => {
      expect(blogArticleMetadataFromSchema({ ...base, robots: {} }).robots).toEqual({
        index: true,
        follow: true,
      })
    })

    it('handles each flag independently', () => {
      expect(blogArticleMetadataFromSchema({ ...base, robots: { noindex: true } }).robots).toEqual({
        index: false,
        follow: true,
      })
      expect(blogArticleMetadataFromSchema({ ...base, robots: { nofollow: true } }).robots).toEqual(
        {
          index: true,
          follow: false,
        },
      )
    })
  })
})
