// Fixture ids are derived from the set name and the file's path (ADR-0019), and
// this is what makes that true rather than aspirational.
//
// The derivation's input is the path, which a statically-imported fixture no
// longer knows — so this reads the tree through Vite's glob rather than the
// loader. `node:fs` would be the obvious tool, but this package deliberately
// compiles without a Node ambient context (it runs under edge and browser
// runtimes too), and a glob keeps that true.
//
// Reading the tree rather than the manifest also catches a fixture on disk that
// nobody registered in the loader — which the runtime tests cannot see by
// construction.

import { describe, expect, it } from 'vitest'

import { fixtureIdFor } from '../../scripts/lib/fixture-id.mjs'
import { allFixtures } from './loader'

/** Vite's glob, typed locally so the package needs no `vite/client` types. */
const globJson = (
  import.meta as unknown as {
    glob: (p: string, o: { eager: true }) => Record<string, { default: unknown }>
  }
).glob('../../fixtures/**/*.json', { eager: true })

/** Directories inside a set that hold content items — mirrors the stamper. */
const ITEM_DIRS = ['components', 'slots', 'pages', 'site-components']

type OnDisk = { setName: string; rel: string; id: string }

const onDisk: OnDisk[] = Object.entries(globJson)
  .map(([key, mod]) => {
    // '../../fixtures/<set>/<dir>/…/<name>.json'
    const [, , , setName, ...rest] = key.split('/')
    return { setName: setName ?? '', rel: rest.join('/'), id: (mod.default as { id: string }).id }
  })
  .filter((f) => ITEM_DIRS.includes(f.rel.split('/')[0] ?? ''))
  .sort((a, b) => `${a.setName}/${a.rel}`.localeCompare(`${b.setName}/${b.rel}`))

describe('fixture ids', () => {
  it('finds the fixture tree', () => {
    // Guards the guard: a bad glob would make everything below vacuously pass.
    expect(onDisk.length).toBeGreaterThan(0)
    expect(new Set(onDisk.map((f) => f.setName)).size).toBeGreaterThan(0)
  })

  it.each(onDisk)('$setName/$rel derives its id', ({ setName, rel, id }) => {
    // Run `pnpm fixtures:ids` after adding, moving or renaming a fixture.
    expect(id).toBe(fixtureIdFor(setName, rel))
  })

  it('is unique across every set, not just within one', () => {
    // Sets share one dc-cli import map per hub, so a collision across sets would
    // have them overwrite each other on seed.
    const ids = onDisk.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a loader entry for every fixture on disk', () => {
    // The manifest is hand-maintained — it has to be, since the mock can't scan
    // disk in a browser or edge runtime — so a new file is easy to author and
    // forget to register. ADR-0012's "loudly absent" applies here too.
    const loaded = new Set(allFixtures().map((f) => f.id))
    const missing = onDisk.filter((f) => !loaded.has(f.id)).map((f) => `${f.setName}/${f.rel}`)
    expect(missing).toEqual([])
  })
})
