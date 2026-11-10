import { describe, expect, it } from 'vitest'

import {
  missingApplications,
  previewApplications,
  withPreviewApplications,
} from './preview-apps.mjs'

const apps = previewApplications({
  localhostUrl: 'http://localhost:3000',
  webApps: [
    { label: 'staging', url: 'https://staging.example.com' },
    { label: '', url: 'https://example.com' },
  ],
})

describe('previewApplications', () => {
  it('builds localhost first, then one per web app', () => {
    expect(apps).toEqual([
      { name: 'Web (localhost)', templatedUri: 'http://localhost:3000/preview/{{vse.domain}}' },
      { name: 'Web (staging)', templatedUri: 'https://staging.example.com/preview/{{vse.domain}}' },
      { name: 'Web', templatedUri: 'https://example.com/preview/{{vse.domain}}' },
    ])
  })
})

describe('withPreviewApplications', () => {
  it('replaces same-named entries and keeps the rest', () => {
    const settings = {
      settings: {
        devices: [{ name: 'Tablet' }],
        applications: [
          { name: 'Web (localhost)', templatedUri: 'http://old/' },
          { name: 'Homepage', templatedUri: 'https://hand-made/' },
        ],
      },
      workflowStates: [],
    }
    const merged = withPreviewApplications(settings, apps)
    expect(merged.settings.applications.map((a) => a.name)).toEqual([
      'Web (localhost)',
      'Web (staging)',
      'Web',
      'Homepage',
    ])
    expect(merged.settings.applications[0]?.templatedUri).toBe(
      'http://localhost:3000/preview/{{vse.domain}}',
    )
    expect(merged.settings.devices).toEqual([{ name: 'Tablet' }])
    expect(merged.workflowStates).toEqual([])
    // The input is not mutated.
    expect(settings.settings.applications).toHaveLength(2)
  })

  it('handles a definition with no applications', () => {
    expect(withPreviewApplications({ settings: {} }, apps).settings.applications).toEqual(apps)
  })
})

describe('missingApplications', () => {
  it('names what the hub lacks', () => {
    expect(missingApplications(apps, [{ name: 'Web' }])).toEqual([
      'Web (localhost)',
      'Web (staging)',
    ])
  })

  it('treats an absent list as empty', () => {
    expect(missingApplications(apps, undefined)).toHaveLength(3)
  })
})
