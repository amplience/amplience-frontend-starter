import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import {
  DEFAULT_FIXTURE_SET,
  readFixtureSets,
  resolveFixtureSet,
  type FixtureSetInfo,
} from './fixture-sets.ts'

// ── readFixtureSets ───────────────────────────────────────────────────────────

/** A throwaway fixtures tree, so discovery can be tested without the real one. */
const tree = (name: string, sets: Record<string, unknown>) => {
  const repoRoot = path.join(import.meta.dirname, '.tmp-fixture-sets', name)
  const root = path.join(repoRoot, 'packages', 'content', 'fixtures')
  for (const [dir, definition] of Object.entries(sets)) {
    mkdirSync(path.join(root, dir), { recursive: true })
    // null = a directory with no set.json, which is not a set.
    if (definition !== null) {
      writeFileSync(path.join(root, dir, 'set.json'), JSON.stringify(definition))
    }
  }
  return repoRoot
}

afterAll(async () => {
  const { rmSync } = await import('node:fs')
  rmSync(path.join(import.meta.dirname, '.tmp-fixture-sets'), { recursive: true, force: true })
})

describe('readFixtureSets', () => {
  it('reads each set.json and sorts by the label the panel shows', () => {
    // Not by directory name: "Anya Finn" reads as belonging below "Amplience
    // Frontend Starter", while `anyafinn` sorts above `frontend-starter`.
    const root = tree('ordered', {
      anyafinn: { name: 'anyafinn', label: 'Anya Finn' },
      'frontend-starter': { name: 'frontend-starter', label: 'Amplience Frontend Starter' },
    })
    expect(readFixtureSets(root).map((s) => s.label)).toEqual([
      'Amplience Frontend Starter',
      'Anya Finn',
    ])
  })

  it('breaks a tie on name, so the order is stable between reads', () => {
    const root = tree('tie', {
      zulu: { name: 'zulu', label: 'Same' },
      alpha: { name: 'alpha', label: 'Same' },
    })
    expect(readFixtureSets(root).map((s) => s.name)).toEqual(['alpha', 'zulu'])
  })

  it('carries the metadata the panel shows', () => {
    const root = tree('metadata', {
      anyafinn: {
        name: 'anyafinn',
        label: 'Anya Finn',
        description: 'Fashion retail demo brand.',
        defaultBrand: 'anyafinn',
        defaultLocale: 'en-US',
        authoredLocales: ['en-US'],
        generatedDocs: false,
      },
    })
    expect(readFixtureSets(root)[0]).toEqual({
      name: 'anyafinn',
      label: 'Anya Finn',
      description: 'Fashion retail demo brand.',
      defaultBrand: 'anyafinn',
      defaultLocale: 'en-US',
      authoredLocales: ['en-US'],
      generatedDocs: false,
    })
  })

  it('takes the directory name as the set name, not set.json', () => {
    // The directory name is the delivery-key prefix every item inside already
    // carries, so it is the one that can't be wrong. The seed scripts refuse on
    // the disagreement; the panel still has to render something.
    const root = tree('disagreement', { anyafinn: { name: 'something-else' } })
    expect(readFixtureSets(root)[0]?.name).toBe('anyafinn')
  })

  it('fills in everything a minimal set.json omits, labelling it by name', () => {
    const root = tree('minimal', { bare: {} })
    expect(readFixtureSets(root)[0]).toEqual({
      name: 'bare',
      label: 'bare',
      description: '',
      defaultBrand: '',
      defaultLocale: '',
      authoredLocales: [],
      generatedDocs: false,
    })
  })

  it('skips a directory with no set.json, and one with unparseable JSON', () => {
    // One unusable directory shouldn't cost the panel the sets either side of it.
    const root = tree('skips', { good: { name: 'good' }, 'not-a-set': null })
    writeFileSync(
      path.join(root, 'packages', 'content', 'fixtures', 'not-a-set', 'set.json'),
      '{ broken',
    )
    expect(readFixtureSets(root).map((s) => s.name)).toEqual(['good'])
  })

  it('returns nothing when there is no fixtures directory', () => {
    expect(readFixtureSets(path.join(import.meta.dirname, 'nowhere'))).toEqual([])
  })
})

describe('readFixtureSets against the real tree', () => {
  // Pins discovery to the sets actually in the repository, so adding one without
  // a `set.json` — or renaming a directory — shows up here.
  const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
  const sets = readFixtureSets(repoRoot)

  it('finds the shipped sets', () => {
    expect(sets.map((s) => s.name)).toContain(DEFAULT_FIXTURE_SET)
    expect(sets.map((s) => s.name)).toContain('anyafinn')
  })

  it('gives every set a label and a default brand to fall back on', () => {
    for (const set of sets) {
      expect(set.label, `${set.name} has no label`).not.toBe('')
      expect(set.defaultBrand, `${set.name} has no defaultBrand`).not.toBe('')
    }
  })

  it('has exactly one set generating docs', () => {
    expect(sets.filter((s) => s.generatedDocs).map((s) => s.name)).toEqual([DEFAULT_FIXTURE_SET])
  })
})

// ── resolveFixtureSet ─────────────────────────────────────────────────────────

const set = (name: string, defaultBrand = name): FixtureSetInfo => ({
  name,
  label: name,
  description: '',
  defaultBrand,
  defaultLocale: 'en-US',
  authoredLocales: ['en-US'],
  generatedDocs: false,
})

describe('resolveFixtureSet', () => {
  const sets = [set('anyafinn'), set(DEFAULT_FIXTURE_SET, 'default')]

  it('matches a site name against the sets, which is the ordinary case', () => {
    expect(resolveFixtureSet('anyafinn', undefined, sets)?.name).toBe('anyafinn')
  })

  it('falls back to the hub default for a site named after neither — the partner path', () => {
    // `frontend-starter` content seeded under `acme/`: the site name is the
    // namespace and says nothing about which content it carries.
    expect(resolveFixtureSet('acme', DEFAULT_FIXTURE_SET, sets)?.name).toBe(DEFAULT_FIXTURE_SET)
  })

  it('prefers the site name over the hub default', () => {
    // A hub carrying several sets can't express them in one hub-level field, so
    // the more specific answer has to win.
    expect(resolveFixtureSet('anyafinn', DEFAULT_FIXTURE_SET, sets)?.name).toBe('anyafinn')
  })

  it('ignores a name that matches no set, at either level', () => {
    expect(resolveFixtureSet('acme', 'also-gone', sets)?.name).toBe(DEFAULT_FIXTURE_SET)
  })

  it('treats blank and whitespace as unset', () => {
    expect(resolveFixtureSet('', '  ', sets)?.name).toBe(DEFAULT_FIXTURE_SET)
    expect(resolveFixtureSet(undefined, undefined, sets)?.name).toBe(DEFAULT_FIXTURE_SET)
  })

  it('falls back to the first set when the default one is not on disk', () => {
    expect(resolveFixtureSet(undefined, undefined, [set('anyafinn')])?.name).toBe('anyafinn')
  })

  it('resolves nothing when there are no sets at all', () => {
    expect(resolveFixtureSet('anyafinn', DEFAULT_FIXTURE_SET, [])).toBeUndefined()
  })
})
