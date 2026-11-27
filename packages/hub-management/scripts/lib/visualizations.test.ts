import { describe, expect, it } from 'vitest'

import { thumbnailSite, withWebAppVisualizations } from './visualizations.mjs'

const contentType = {
  settings: {
    label: 'Card',
    cards: [] as { templatedUri?: string }[],
    visualizations: [
      { label: 'Web (localhost)', templatedUri: 'http://localhost:3000/v', default: true },
      { label: 'JSON', templatedUri: 'https://json/', default: false },
    ],
  },
}

const staging = { label: 'staging', url: 'https://staging.example.com' }
const prod = { label: '', url: 'https://example.com' }

describe('thumbnailSite', () => {
  it('falls back to the first site when none is flagged', () => {
    expect(thumbnailSite([staging, prod])).toBe(staging)
  })

  it('prefers the flagged site, first flag wins', () => {
    const flagged = { ...prod, thumbnail: true }
    expect(thumbnailSite([staging, flagged, { ...staging, thumbnail: true }])).toBe(flagged)
  })

  it('is undefined for no sites', () => {
    expect(thumbnailSite([])).toBeUndefined()
  })
})

describe('withWebAppVisualizations', () => {
  it('leaves a definition alone when the hub has no sites', () => {
    expect(withWebAppVisualizations(contentType, [])).toEqual(contentType)
  })

  it('makes the first site the thumbnail and default when none is flagged', () => {
    const out = withWebAppVisualizations(contentType, [staging, prod])
    expect(out.settings.cards?.[0]?.templatedUri).toBe(
      'https://staging.example.com/visualization?vse={{vse.domain}}&content={{content.sys.id}}&isThumbnail=true',
    )
    expect(out.settings.visualizations.map((v) => [v.label, v.default])).toEqual([
      ['Web (staging)', true],
      ['Web', false],
      ['Web (localhost)', false],
      ['JSON', false],
    ])
  })

  it('makes a flagged site both the thumbnail and the only default', () => {
    const out = withWebAppVisualizations(contentType, [staging, { ...prod, thumbnail: true }])
    expect(out.settings.cards?.[0]?.templatedUri).toMatch(/^https:\/\/example\.com\//)
    expect(out.settings.visualizations.filter((v) => v.default).map((v) => v.label)).toEqual([
      'Web',
    ])
  })

  it('does not mutate its input', () => {
    withWebAppVisualizations(contentType, [{ ...prod, thumbnail: true }])
    expect(contentType.settings.visualizations).toHaveLength(2)
    expect(contentType.settings.visualizations[0]?.default).toBe(true)
    expect(contentType.settings.cards).toHaveLength(0)
  })
})
