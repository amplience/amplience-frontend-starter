// Tests for DynamicImage utility functions (QL-65).

import { describe, expect, it } from 'vitest'

import type { AmplienceImageLink, TransformedImageField } from '@amplience/quadratic-types'

import {
  amplienceDiLoader,
  aspectLockToCss,
  buildDiBaseUrl,
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

describe('aspectLockToCss', () => {
  it('converts "16:9" to "16 / 9"', () => {
    expect(aspectLockToCss('16:9')).toBe('16 / 9')
  })

  it('converts "4:3" to "4 / 3"', () => {
    expect(aspectLockToCss('4:3')).toBe('4 / 3')
  })

  it('converts "1:1" to "1 / 1"', () => {
    expect(aspectLockToCss('1:1')).toBe('1 / 1')
  })

  it('returns undefined for undefined input', () => {
    expect(aspectLockToCss(undefined)).toBeUndefined()
  })

  it('returns undefined for malformed input (no colon)', () => {
    expect(aspectLockToCss('169')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(aspectLockToCss('')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveDiAspectRatio
// ---------------------------------------------------------------------------

describe('resolveDiAspectRatio', () => {
  const base: TransformedImageField = { image: sampleLink }

  it('prefers an authored aspectLock over everything else', () => {
    expect(resolveDiAspectRatio({ ...base, aspectLock: '16:9', aspectRatio: 1.3393 })).toBe(
      '16 / 9',
    )
  })

  it('treats aspectLock "none" as absent and falls through to the extension ratio', () => {
    expect(resolveDiAspectRatio({ ...base, aspectLock: 'none', aspectRatio: 1.7264 })).toBe(
      '1.7264',
    )
  })

  it('uses the extension-written decimal aspectRatio when no aspectLock', () => {
    expect(resolveDiAspectRatio({ ...base, aspectRatio: 1.3393 })).toBe('1.3393')
  })

  it('falls back to srcWidth / srcHeight when no ratio and no crop', () => {
    expect(resolveDiAspectRatio({ ...base, srcWidth: 1200, srcHeight: 896 })).toBe('1200 / 896')
  })

  it('does NOT use srcWidth / srcHeight when the query carries a crop (original dims describe the uncropped asset)', () => {
    expect(
      resolveDiAspectRatio({
        ...base,
        srcWidth: 1200,
        srcHeight: 896,
        query: 'crop={2.25%},{14.62%},{94.67%},{73.44%}',
      }),
    ).toBeUndefined()
  })

  it('still uses the extension aspectRatio when a crop is present (it is crop-aware)', () => {
    expect(
      resolveDiAspectRatio({
        ...base,
        aspectRatio: 1.7264,
        srcWidth: 1200,
        srcHeight: 896,
        query: 'crop={2.25%},{14.62%},{94.67%},{73.44%}',
      }),
    ).toBe('1.7264')
  })

  it('returns undefined for legacy payloads with no dimension data (no guessed default)', () => {
    expect(resolveDiAspectRatio(base)).toBeUndefined()
  })

  it('rejects non-positive values', () => {
    expect(resolveDiAspectRatio({ ...base, aspectRatio: 0 })).toBeUndefined()
    expect(resolveDiAspectRatio({ ...base, srcWidth: 0, srcHeight: 896 })).toBeUndefined()
  })
})
