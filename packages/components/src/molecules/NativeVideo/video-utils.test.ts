import { describe, expect, it } from 'vitest'

import {
  damVideoSources,
  damVideoThumbnailUrl,
  loadTierFromProps,
  resolvePlayback,
  videoAspectRatioCss,
  videoAspectRatioNumber,
} from './video-utils'

const link = { name: 'Big Buck', endpoint: 'demo', defaultHost: 'cdn.media.amplience.net' }

describe('video aspect ratio', () => {
  it('converts the authored shape to CSS and a number', () => {
    expect(videoAspectRatioCss('9:16')).toBe('9 / 16')
    expect(videoAspectRatioNumber('4:3')).toBeCloseTo(4 / 3)
  })

  it('defaults to 16:9, including for a malformed payload', () => {
    expect(videoAspectRatioCss(undefined)).toBe('16 / 9')
    expect(videoAspectRatioCss('wide' as never)).toBe('16 / 9')
  })
})

describe('resolvePlayback', () => {
  it('lets a context override win, then the authored value, then player', () => {
    expect(resolvePlayback('player', 'ambient')).toBe('ambient')
    expect(resolvePlayback('ambient', undefined)).toBe('ambient')
    expect(resolvePlayback(undefined, undefined)).toBe('player')
  })
})

describe('loadTierFromProps', () => {
  it('recovers the ADR-0021 tier from next/image props', () => {
    expect(loadTierFromProps({ priority: true })).toBe('lcp')
    expect(loadTierFromProps({ loading: 'eager' })).toBe('eager')
    expect(loadTierFromProps({})).toBe('lazy')
  })
})

describe('DAM video URLs', () => {
  it('lists a small-screen rendition first, then the fallbacks', () => {
    const sources = damVideoSources(link)
    expect(sources[0]).toEqual({
      src: 'https://cdn.media.amplience.net/v/demo/Big%20Buck/mp4_720p',
      type: 'video/mp4',
      media: '(max-width: 768px)',
    })
    expect(sources.slice(1).map((s) => s.src.split('/').pop())).toEqual([
      'mp4_1080p',
      'mp4_720p',
      'mp4_480p',
    ])
  })

  it('takes a custom profile list', () => {
    expect(damVideoSources(link, [{ profile: 'mp4_1440p', type: 'video/mp4' }])).toEqual([
      { src: 'https://cdn.media.amplience.net/v/demo/Big%20Buck/mp4_1440p', type: 'video/mp4' },
    ])
  })

  it('points the thumbnail at the profile-less video URL, sized with w', () => {
    expect(damVideoThumbnailUrl(link, 640)).toBe(
      'https://cdn.media.amplience.net/v/demo/Big%20Buck?w=640',
    )
  })
})
