import { describe, expect, it } from 'vitest'

import {
  defaultSiteName,
  LEGACY_FIXTURES_NAME,
  migrateActive,
  namespaceForSet,
  resolveActiveSource,
  siteIdentity,
  type ActiveSourceEnv,
} from './active-source.ts'
import { DEFAULT_FIXTURE_SET, type FixtureSetInfo } from './fixture-sets.ts'

const set = (name: string, defaultBrand = name, label = name): FixtureSetInfo => ({
  name,
  label,
  description: '',
  defaultBrand,
  defaultLocale: 'en-US',
  authoredLocales: ['en-US'],
  generatedDocs: false,
})

const SETS = [set('anyafinn', 'anyafinn', 'Anya Finn'), set(DEFAULT_FIXTURE_SET, 'default')]

const hub = (over: Partial<ActiveSourceEnv> = {}): ActiveSourceEnv => ({
  name: 'mattdemo',
  hubName: 'mattdemo',
  defaultSite: '',
  defaultBrand: '',
  ...over,
})

describe('migrateActive', () => {
  it('turns the old sentinel into the name of the set it meant', () => {
    expect(migrateActive(LEGACY_FIXTURES_NAME, SETS)).toBe(DEFAULT_FIXTURE_SET)
  })

  it('leaves anything else alone, and is a no-op run twice', () => {
    expect(migrateActive('mattdemo', SETS)).toBe('mattdemo')
    expect(migrateActive(migrateActive(LEGACY_FIXTURES_NAME, SETS), SETS)).toBe(DEFAULT_FIXTURE_SET)
  })

  it('leaves the sentinel in place when there is nothing to migrate it to', () => {
    // A checkout with no fixtures is broken; losing the only clue about what was
    // active wouldn't help anyone diagnose it.
    expect(migrateActive(LEGACY_FIXTURES_NAME, [])).toBe(LEGACY_FIXTURES_NAME)
  })
})

describe('resolveActiveSource', () => {
  it('resolves a hub, and the set its localhost row serves', () => {
    const source = resolveActiveSource('mattdemo', [hub({ defaultSite: 'anyafinn' })], SETS)
    expect(source.kind).toBe('hub')
    expect(source.kind === 'hub' && source.set?.name).toBe('anyafinn')
  })

  it('resolves a set by name', () => {
    const source = resolveActiveSource('anyafinn', [], SETS)
    expect(source).toEqual({ kind: 'set', set: SETS[0] })
  })

  it('still resolves the legacy sentinel', () => {
    // An older config, or a client that hasn't caught up, shouldn't land on "none".
    expect(resolveActiveSource(LEGACY_FIXTURES_NAME, [], SETS)).toEqual({
      kind: 'set',
      set: SETS[1],
    })
  })

  it('gives a hub precedence over a set of the same name', () => {
    // Hubs are user-named; a collision must not take someone's hub away.
    const source = resolveActiveSource('anyafinn', [hub({ name: 'anyafinn' })], SETS)
    expect(source.kind).toBe('hub')
  })

  it('resolves to none when the name matches neither', () => {
    expect(resolveActiveSource('deleted-hub', [], SETS)).toEqual({ kind: 'none' })
  })
})

describe('namespaceForSet', () => {
  it('uses the site that serves the set, not the localhost row', () => {
    // A hub carrying two sets: seeding anyafinn into the localhost row's
    // namespace is the 409 this exists to prevent.
    const env = hub({ defaultSite: 'frontend-starter' })
    expect(namespaceForSet('anyafinn', env, ['anyafinn'], SETS)).toBe('anyafinn')
  })

  it('uses the localhost row when that is the site serving the set', () => {
    const env = hub({ defaultSite: 'frontend-starter' })
    expect(namespaceForSet(DEFAULT_FIXTURE_SET, env, ['anyafinn'], SETS)).toBe('frontend-starter')
  })

  it('keeps the partner namespace rather than letting the set override it', () => {
    // `frontend-starter` content under `acme/`. Making --set override SITE_NAME
    // would conflate which content with which namespace, and lose this path.
    const env = hub({ defaultSite: 'acme', defaultFixtureSet: DEFAULT_FIXTURE_SET })
    expect(namespaceForSet(DEFAULT_FIXTURE_SET, env, [], SETS)).toBe('acme')
  })

  it("falls back to the set's name, not the hub's, when the localhost row names no site", () => {
    // ADR-0019: the same default hub-import and resolveContentConfig apply.
    const env = hub({ hubName: 'mattdemo', defaultFixtureSet: DEFAULT_FIXTURE_SET })
    expect(namespaceForSet(DEFAULT_FIXTURE_SET, env, [], SETS)).toBe(DEFAULT_FIXTURE_SET)
  })

  it('falls back to the set name when no site on the hub serves it', () => {
    // What a bare `--set` does on the terminal, and the ADR-0014 default.
    const env = hub({ defaultSite: 'frontend-starter' })
    expect(namespaceForSet('anyafinn', env, [], SETS)).toBe('anyafinn')
  })

  it('ignores blank site names', () => {
    const env = hub({ defaultSite: 'frontend-starter' })
    expect(namespaceForSet('anyafinn', env, ['', '  ', 'anyafinn'], SETS)).toBe('anyafinn')
  })
})

describe('defaultSiteName', () => {
  it('uses the localhost row when it names a site', () => {
    expect(defaultSiteName(hub({ defaultSite: 'acme' }), SETS)).toBe('acme')
  })

  it("falls back to the hub's default set, then the default set — never the hub name", () => {
    expect(defaultSiteName(hub({ defaultFixtureSet: 'anyafinn' }), SETS)).toBe('anyafinn')
    expect(defaultSiteName(hub({ hubName: 'mattdemo' }), SETS)).toBe(DEFAULT_FIXTURE_SET)
  })

  it('only falls back to the hub name in a checkout with no sets at all', () => {
    expect(defaultSiteName(hub({ hubName: 'mattdemo' }), [])).toBe('mattdemo')
  })
})

describe('siteIdentity', () => {
  it('describes an active set as its own site', () => {
    expect(siteIdentity(resolveActiveSource('anyafinn', [], SETS))).toEqual({
      siteName: 'anyafinn',
      fixtureSet: 'anyafinn',
      brand: 'anyafinn',
      title: 'Anya Finn',
    })
  })

  it('pairs a hub site name with the set it resolves to', () => {
    // The whole point: these two are derived in one place, so no action can set
    // one without the other.
    const id = siteIdentity(
      resolveActiveSource('mattdemo', [hub({ defaultSite: 'anyafinn' })], SETS),
    )
    expect(id).toMatchObject({ siteName: 'anyafinn', fixtureSet: 'anyafinn' })
  })

  it("falls a blank site name back to the set's name, per ADR-0019", () => {
    const id = siteIdentity(resolveActiveSource('mattdemo', [hub({ hubName: 'mattdemo' })], SETS))
    expect(id).toMatchObject({ siteName: DEFAULT_FIXTURE_SET, fixtureSet: DEFAULT_FIXTURE_SET })
  })

  it('serves the hub default set to a site named after no set — the partner path', () => {
    const env = hub({ defaultSite: 'acme', defaultFixtureSet: DEFAULT_FIXTURE_SET })
    expect(siteIdentity(resolveActiveSource('mattdemo', [env], SETS))).toMatchObject({
      siteName: 'acme',
      fixtureSet: DEFAULT_FIXTURE_SET,
    })
  })

  it('prefers the site brand over the set brand', () => {
    const env = hub({ defaultSite: 'anyafinn', defaultBrand: 'acme' })
    expect(siteIdentity(resolveActiveSource('mattdemo', [env], SETS))?.brand).toBe('acme')
  })

  it('falls back to the set brand when the site names none', () => {
    // This is the originating bug: switching to a set used to clear the brand,
    // because nothing on the fixtures side carried one.
    const env = hub({ defaultSite: 'anyafinn' })
    expect(siteIdentity(resolveActiveSource('mattdemo', [env], SETS))?.brand).toBe('anyafinn')
  })

  it('titles pages from the set only when the set is the source', () => {
    const env = hub({ defaultSite: 'anyafinn' })
    expect(siteIdentity(resolveActiveSource('mattdemo', [env], SETS))?.title).toBeUndefined()
    expect(siteIdentity(resolveActiveSource('anyafinn', [], SETS))?.title).toBe('Anya Finn')
  })

  it('has no identity when nothing resolves', () => {
    expect(siteIdentity({ kind: 'none' })).toBeUndefined()
  })
})
