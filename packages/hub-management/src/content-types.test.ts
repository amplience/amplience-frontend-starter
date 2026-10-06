/**
 * Every content type is registered for the hub, and registered completely.
 *
 * Adding a type means touching several places, and the ones a schema test
 * already covers are not the ones that bite: a schema can validate perfectly
 * while the type lands in the hub unnamed, iconless and with no visualization,
 * because its `content-types/` registration was never written. That is a
 * silent, hub-only failure — nothing in the app notices.
 *
 * `hub-import` reads this directory from disk, so this test does too rather
 * than from a hand-maintained list, which would be one more thing to forget.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { contentTypeSchemas } from './index'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type Registration = {
  contentTypeUri?: string
  status?: string
  settings?: {
    label?: string
    icons?: { size?: number; url?: string }[]
    visualizations?: { label?: string; templatedUri?: string; default?: boolean }[]
  }
  repositories?: string[]
}

const registrations = readdirSync(path.join(packageRoot, 'content-types'))
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({
    file,
    data: JSON.parse(
      readFileSync(path.join(packageRoot, 'content-types', file), 'utf8'),
    ) as Registration,
  }))

const byUri = new Map(registrations.map((r) => [r.data.contentTypeUri ?? '', r]))

describe('content-type registrations', () => {
  it('registers every content type the schema manifest declares', () => {
    const missing = contentTypeSchemas
      .map((e) => e.schemaId)
      .filter((id) => !byUri.has(id))
      .sort()
    expect(missing, 'no content-types/*.json for these schema ids').toEqual([])
  })

  it('registers nothing that has no schema', () => {
    const ids = new Set(contentTypeSchemas.map((e) => e.schemaId))
    const orphans = registrations
      .filter((r) => !ids.has(r.data.contentTypeUri ?? ''))
      .map((r) => r.file)
      .sort()
    expect(orphans, 'registered but no schema in the manifest').toEqual([])
  })

  describe.each(registrations)('$file', ({ data }) => {
    it('is ACTIVE and lands in a repository', () => {
      expect(data.status).toBe('ACTIVE')
      expect(data.repositories?.length ?? 0).toBeGreaterThan(0)
    })

    it('carries a human label, not a bare slug', () => {
      // Without this the hub shows the schema's last path segment —
      // "product-carousel" where an author expects "Product Carousel Block".
      const label = data.settings?.label ?? ''
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toMatch(/^[a-z0-9-]+$/)
    })

    it('carries an icon', () => {
      const [icon] = data.settings?.icons ?? []
      expect(icon?.url, 'settings.icons[0].url').toMatch(/^https:\/\//)
      expect(icon?.size).toBe(256)
    })

    it('carries exactly one default visualization', () => {
      const visualizations = data.settings?.visualizations ?? []
      expect(visualizations.length).toBeGreaterThan(0)
      expect(visualizations.filter((v) => v.default === true)).toHaveLength(1)
    })
  })

  it('names its icon asset after the registration file, so the DAM is predictable', () => {
    // `hub-import` does not upload icons; they are DAM assets whose names match
    // the type. A mismatch here is a 404 nobody sees until the hub renders it.
    for (const { file, data } of registrations) {
      const expected = file.replace(/\.json$/, '')
      expect(data.settings?.icons?.[0]?.url, file).toContain(expected)
    }
  })
})
