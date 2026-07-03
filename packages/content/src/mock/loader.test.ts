// Loader unit tests — the fixture manifest and its lookup maps.
//
// The interesting structural cases live in the fixture set itself: items
// with one key, several keys (about), and none at all (the docs markdown
// block, resolved only by ID through its slot) — the same mix a real hub
// produces, where nested components are rarely keyed.

import { describe, expect, it } from 'vitest'

import { allFixtures, findById, findByKey } from './loader'

describe('loader', () => {
  it('exposes a non-empty fixture set with unique ids', () => {
    const fixtures = allFixtures()
    expect(fixtures.length).toBeGreaterThan(0)
    const ids = fixtures.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('finds every fixture by its id', () => {
    for (const fixture of allFixtures()) {
      expect(findById(fixture.id)).toBe(fixture)
    }
  })

  it('maps every declared delivery key back to its item', () => {
    for (const fixture of allFixtures()) {
      const keys = fixture.body._meta.deliveryKeys?.values ?? []
      for (const k of keys) {
        expect(findByKey(k.value)).toBe(fixture)
      }
    }
  })

  it('indexes a keyless fixture by id only', () => {
    // The docs markdown block carries no delivery key — reachable through
    // its slot's content-link (by ID), absent from the key map.
    const keyless = findById('a1b2c3d4-0003-4000-8000-000000000003')
    expect(keyless).toBeDefined()
    expect(keyless?.body._meta.deliveryKeys).toBeUndefined()
    expect(findByKey('base-site/docs/markdown')).toBeUndefined()
  })

  it('returns undefined for unknown ids and keys', () => {
    expect(findById('00000000-0000-4000-8000-00000000dead')).toBeUndefined()
    expect(findByKey('no-such-key')).toBeUndefined()
  })
})
