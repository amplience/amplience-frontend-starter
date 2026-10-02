// Loader unit tests — the set registry, and each set's lookup maps.
//
// The interesting structural cases live in the fixture set itself: items
// with one key, several keys (about), and none at all (component blocks like
// heroes and markdown, resolved only by ID through their slot) — the same mix a
// real hub produces, where nested components are rarely keyed.

import { describe, expect, it } from 'vitest'

import { FIXTURE_SITE_NAME } from '../config'
import {
  allFixtures,
  allFixtureSets,
  DEFAULT_FIXTURE_SET,
  fixtureSetNames,
  resolveFixtureSet,
} from './loader'

describe('registry', () => {
  it('serves the set the zero-config deployment resolves to', () => {
    // config.ts can't import the registry (it would drag every fixture into
    // sdk-mode bundles), so the default it hands out has to name a real set.
    expect(fixtureSetNames()).toContain(FIXTURE_SITE_NAME)
    expect(DEFAULT_FIXTURE_SET).toBe(FIXTURE_SITE_NAME)
  })

  it('throws on an unknown set, naming the ones it has', () => {
    expect(() => resolveFixtureSet('no-such-set')).toThrow(/Unknown fixture set "no-such-set"/)
    // The message has to name the sets that do exist, or it isn't actionable.
    expect(() => resolveFixtureSet('no-such-set')).toThrow(FIXTURE_SITE_NAME)
  })

  it('names every set after its own delivery-key prefix', () => {
    // The set name, the site name and the key prefix are one string (ADR-0019);
    // a set whose keys disagree would resolve nothing at runtime.
    for (const set of allFixtureSets()) {
      for (const fixture of set.fixtures) {
        for (const k of fixture.body._meta.deliveryKeys?.values ?? []) {
          expect(k.value.startsWith(`${set.name}/`), `${set.name}: ${k.value}`).toBe(true)
        }
      }
    }
  })

  it('gives every fixture in the corpus a unique id', () => {
    // Across sets, not just within one: they share a dc-cli import map per hub,
    // so a collision would make two sets overwrite each other on seed.
    const ids = allFixtures().map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// Lookups belong to a set, so these run against each one — a set's map must
// resolve its own fixtures and nothing else.
describe.each(allFixtureSets())('loader — $name', (set) => {
  it('exposes a non-empty fixture set with unique ids', () => {
    expect(set.fixtures.length).toBeGreaterThan(0)
    const ids = set.fixtures.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('finds every fixture by its id', () => {
    for (const fixture of set.fixtures) {
      expect(set.findById(fixture.id)).toBe(fixture)
    }
  })

  it('maps every declared delivery key back to its item', () => {
    for (const fixture of set.fixtures) {
      const keys = fixture.body._meta.deliveryKeys?.values ?? []
      for (const k of keys) {
        expect(set.findByKey(k.value)).toBe(fixture)
      }
    }
  })

  it('indexes a keyless fixture by id only', () => {
    // Component blocks (heroes, markdown) carry no delivery key — reachable
    // through their slot's content-link (by ID), absent from the key map. Pick
    // one from the set rather than hard-coding an ID (docs fixtures are
    // generated, so their IDs aren't stable to reference here).
    const keyless = set.fixtures.find((f) => f.body._meta.deliveryKeys === undefined)
    expect(keyless).toBeDefined()
    if (!keyless) return
    expect(set.findById(keyless.id)).toBe(keyless)
    expect(set.findByKey(keyless.id)).toBeUndefined()
  })

  it('returns undefined for unknown ids and keys', () => {
    expect(set.findById('00000000-0000-4000-8000-00000000dead')).toBeUndefined()
    expect(set.findByKey('no-such-key')).toBeUndefined()
  })
})
