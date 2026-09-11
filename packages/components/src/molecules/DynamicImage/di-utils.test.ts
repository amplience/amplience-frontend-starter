// Tests for DynamicImage utility functions (QL-65).

import { describe, expect, it } from 'vitest'

import type {
  AmplienceImageLink,
  ContentMediaData,
  TransformedImageField,
} from '@amplience/frontend-starter-types'

import {
  amplienceDiLoader,
  buildDiBaseUrl,
  contentMediaUrl,
  resolveDiAspectRatio,
} from './di-utils'

const sampleLink: AmplienceImageLink = {
  name: 'hero-image',
  endpoint: 'my-store',
  defaultHost: 'cdn.media.amplience.net',
}

describe('buildDiBaseUrl', () => {
  it('constructs the correct https://{defaultHost}/i/{endpoint}/{name} pattern', () => {
    expect(buildDiBaseUrl(sampleLink)).toBe('https://cdn.media.amplience.net/i/my-store/hero-image')
  })

  it('URL-encodes the image name', () => {
    const link: AmplienceImageLink = {
      name: 'my image/with spaces',
      endpoint: 'demo',
      defaultHost: 'cdn.media.amplience.net',
    }
    expect(buildDiBaseUrl(link)).toBe(
      'https://cdn.media.amplience.net/i/demo/my%20image%2Fwith%20spaces',
    )
  })
})

describe('amplienceDiLoader', () => {
  it('appends ?fmt=webp&w= when src has no existing query string', () => {
    const result = amplienceDiLoader({
      src: 'https://cdn.media.amplience.net/i/demo/img',
      width: 800,
      quality: 75,
    })
    expect(result).toBe('https://cdn.media.amplience.net/i/demo/img?fmt=webp&w=800')
  })

  it('appends &fmt=webp&w= when src already has a query string', () => {
    const result = amplienceDiLoader({
      src: 'https://cdn.media.amplience.net/i/demo/img?sm=aspect&aspect=16:9',
      width: 1200,
      quality: 75,
    })
    expect(result).toBe(
      'https://cdn.media.amplience.net/i/demo/img?sm=aspect&aspect=16:9&fmt=webp&w=1200',
    )
  })
})

// ---------------------------------------------------------------------------
// resolveDiAspectRatio
// ---------------------------------------------------------------------------

describe('resolveDiAspectRatio', () => {
  const base: TransformedImageField = { image: sampleLink }

  it('uses the extension-written decimal aspectRatio (delivered ratio)', () => {
    expect(resolveDiAspectRatio({ ...base, aspectRatio: 1.3393 })).toBe('1.3393')
  })

  it('prefers aspectRatio over width / height when both are present', () => {
    expect(resolveDiAspectRatio({ ...base, aspectRatio: 1.7264, width: 1136, height: 658 })).toBe(
      '1.7264',
    )
  })

  it('falls back to delivered width / height when aspectRatio is absent', () => {
    expect(resolveDiAspectRatio({ ...base, width: 1200, height: 896 })).toBe('1200 / 896')
  })

  it('uses width / height regardless of any crop in the query (they describe the DELIVERED image)', () => {
    expect(
      resolveDiAspectRatio({
        ...base,
        width: 1136,
        height: 658,
        query: 'crop={2.25%},{14.62%},{94.67%},{73.44%}',
      }),
    ).toBe('1136 / 658')
  })

  it('returns undefined for legacy payloads with no dimension data (no guessed default)', () => {
    expect(resolveDiAspectRatio(base)).toBeUndefined()
  })

  it('rejects non-positive values', () => {
    expect(resolveDiAspectRatio({ ...base, aspectRatio: 0 })).toBeUndefined()
    expect(resolveDiAspectRatio({ ...base, width: 0, height: 896 })).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// contentMediaUrl
// ---------------------------------------------------------------------------

describe('contentMediaUrl', () => {
  const dynamic: ContentMediaData = {
    mediaType: 'DynamicImage',
    image: { image: sampleLink },
  }

  it('returns the authored src as-is for a ManualImage', () => {
    const manual: ContentMediaData = {
      mediaType: 'ManualImage',
      image: { src: '/social-card.png', alt: 'Card', width: 1200, height: 630 },
    }
    expect(contentMediaUrl(manual)).toBe('/social-card.png')
    expect(contentMediaUrl(manual, { width: 1200 })).toBe('/social-card.png')
  })

  it('builds the bare DI URL for a DynamicImage with no query and no width', () => {
    expect(contentMediaUrl(dynamic)).toBe('https://cdn.media.amplience.net/i/my-store/hero-image')
  })

  it('appends the width cap for a DynamicImage', () => {
    expect(contentMediaUrl(dynamic, { width: 1200 })).toBe(
      'https://cdn.media.amplience.net/i/my-store/hero-image?w=1200',
    )
  })

  it('carries the pre-baked transform query and appends width after it', () => {
    const cropped: ContentMediaData = {
      mediaType: 'DynamicImage',
      image: { image: sampleLink, query: 'crop={10%},{20%},{80%},{60%}' },
    }
    expect(contentMediaUrl(cropped, { width: 1200 })).toBe(
      'https://cdn.media.amplience.net/i/my-store/hero-image?crop={10%},{20%},{80%},{60%}&w=1200',
    )
  })

  it('normalises a query that already starts with "?"', () => {
    const prefixed: ContentMediaData = {
      mediaType: 'DynamicImage',
      image: { image: sampleLink, query: '?sm=aspect&aspect=16:9' },
    }
    expect(contentMediaUrl(prefixed)).toBe(
      'https://cdn.media.amplience.net/i/my-store/hero-image?sm=aspect&aspect=16:9',
    )
  })

  it('returns undefined when the DynamicImage link is incomplete', () => {
    const broken: ContentMediaData = {
      mediaType: 'DynamicImage',
      image: { image: { name: '', endpoint: 'my-store', defaultHost: 'cdn.media.amplience.net' } },
    }
    expect(contentMediaUrl(broken)).toBeUndefined()
  })
})
