// Tests for the tier → next/image prop mapping (ADR-0021).
//
// These assertions are deliberately exact rather than partial: the value of
// this helper is that it is the *only* place these props are constructed, so a
// tier gaining or losing one is a decision, not an implementation detail. In
// particular the middle tier must carry `loading: 'eager'` and nothing else —
// a stray `priority` there would emit a preload competing with the LCP, which
// is the whole reason the tier exists.

import { describe, expect, it } from 'vitest'

import { mediaLoadingProps } from './mediaLoadingProps'

describe('mediaLoadingProps', () => {
  it("maps 'lcp' to eager loading, a preload hint and high fetch priority", () => {
    expect(mediaLoadingProps('lcp')).toEqual({ priority: true, fetchPriority: 'high' })
  })

  it("maps 'eager' to eager loading only — no preload, no fetch-priority bump", () => {
    expect(mediaLoadingProps('eager')).toEqual({ loading: 'eager' })
  })

  it("maps 'lazy' to no props at all, leaving next/image's default in place", () => {
    expect(mediaLoadingProps('lazy')).toEqual({})
  })

  it('defaults to lazy when no tier is given', () => {
    expect(mediaLoadingProps()).toEqual({})
    expect(mediaLoadingProps(undefined)).toEqual({})
  })

  // next/image throws on `priority` + `loading="lazy"` and on `priority` +
  // `preload`. No tier can produce either, which is what makes the throwing
  // combinations unrepresentable rather than merely avoided.
  it('never emits priority and loading together', () => {
    for (const tier of ['lcp', 'eager', 'lazy'] as const) {
      const props = mediaLoadingProps(tier)
      expect('priority' in props && 'loading' in props).toBe(false)
    }
  })
})
