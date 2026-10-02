import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Plain ESM (.mjs), shared with the import and wipe scripts; import it directly
// so these exercise the exact code a destructive run uses.
import {
  availableSets,
  flagValue,
  positional,
  readAllSets,
  readFlag,
  readSet,
  resolveSetName,
  setFromArgv,
} from './fixture-sets.mjs'

let root: string

/** Write a set directory, optionally with a `set.json` that lies about its name. */
const writeSet = (dir: string, items: Record<string, string>, declaredName = dir) => {
  mkdirSync(path.join(root, dir, 'components'), { recursive: true })
  writeFileSync(path.join(root, dir, 'set.json'), JSON.stringify({ name: declaredName }))
  for (const [file, id] of Object.entries(items)) {
    writeFileSync(
      path.join(root, dir, 'components', `${file}.json`),
      JSON.stringify({ id, label: file, body: { _meta: { schema: 'x' } } }),
    )
  }
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'fixture-sets-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('availableSets', () => {
  it('counts a directory as a set only when it holds a set.json', () => {
    writeSet('alpha', { one: 'id-1' })
    mkdirSync(path.join(root, 'not-a-set'), { recursive: true })
    expect(availableSets(root)).toEqual(['alpha'])
  })

  it('sorts them, so output is stable between machines', () => {
    writeSet('zulu', { one: 'id-1' })
    writeSet('alpha', { one: 'id-2' })
    expect(availableSets(root)).toEqual(['alpha', 'zulu'])
  })
})

describe('readSet', () => {
  it('collects the ids of every item in the set', () => {
    writeSet('alpha', { one: 'id-1', two: 'id-2' })
    expect([...readSet('alpha', root).ids].sort()).toEqual(['id-1', 'id-2'])
  })

  it('refuses a set whose directory and set.json disagree about its name', () => {
    // The directory name is the delivery-key prefix on every item inside, so a
    // set.json claiming otherwise means the two disagree about what this set is
    // — and everything downstream would pick a side silently. Found by renaming
    // a set directory in place and watching it still be attributed, 1 Oct 2026.
    writeSet('_anyafinn', { one: 'id-1' }, 'anyafinn')
    expect(() => readSet('_anyafinn', root)).toThrow(/holds a set.json naming "anyafinn"/)
  })

  it('reads ids from the files rather than re-deriving them from paths', () => {
    // What was seeded is what the file said at the time; re-deriving would
    // disagree with the hub whenever a stamping run is pending.
    writeSet('alpha', { one: 'deliberately-not-a-derived-id' })
    expect([...readSet('alpha', root).ids]).toEqual(['deliberately-not-a-derived-id'])
  })
})

describe('readAllSets', () => {
  it('reads every set under the root', () => {
    writeSet('alpha', { one: 'id-1' })
    writeSet('beta', { one: 'id-2', two: 'id-3' })
    expect(readAllSets(root).map((s) => [s.name, s.ids.size])).toEqual([
      ['alpha', 1],
      ['beta', 2],
    ])
  })
})

describe('resolveSetName', () => {
  it('takes what was asked for', () => {
    writeSet('alpha', { one: 'id-1' })
    expect(resolveSetName('alpha', { root })).toBe('alpha')
  })

  it('falls back when nothing was asked for', () => {
    writeSet('alpha', { one: 'id-1' })
    expect(resolveSetName(undefined, { root, fallback: 'alpha' })).toBe('alpha')
  })

  it('names what is available when the request misses', () => {
    writeSet('alpha', { one: 'id-1' })
    writeSet('beta', { one: 'id-2' })
    expect(() => resolveSetName('gamma', { root })).toThrow(/available: alpha, beta/)
  })
})

describe('readFlag', () => {
  it('tells an absent flag from a bare one', () => {
    expect(readFlag(['content'], '--set')).toEqual({ present: false, value: undefined })
    expect(readFlag(['--set'], '--set')).toEqual({ present: true, value: undefined })
    expect(readFlag(['content', '--set'], '--set')).toEqual({ present: true, value: undefined })
    expect(readFlag(['--set='], '--set')).toEqual({ present: true, value: undefined })
  })

  it("doesn't take the next flag as the value", () => {
    expect(readFlag(['--set', '--apply'], '--set')).toEqual({ present: true, value: undefined })
  })

  it('reads both spellings', () => {
    expect(flagValue(['--set', 'alpha'], '--set')).toBe('alpha')
    expect(flagValue(['--set=alpha'], '--set')).toBe('alpha')
  })
})

describe('positional', () => {
  it('skips the value after --set, but not a flag after a bare one', () => {
    expect(positional(['--set', 'alpha', 'content'])).toBe('content')
    expect(positional(['--set'])).toBeUndefined()
    expect(positional(['--set', '--custom', 'content'])).toBe('content')
  })
})

describe('setFromArgv', () => {
  // vitest's stdin is not a TTY, which is the Environment Manager / CI case.
  it('is undefined only when --set is absent, so callers keep their fallback', async () => {
    expect(await setFromArgv(['content'], { root })).toBeUndefined()
  })

  it('returns the named set', async () => {
    writeSet('alpha', { one: 'id-1' })
    expect(await setFromArgv(['--set', 'alpha'], { root })).toBe('alpha')
  })

  it('refuses a bare --set without a terminal, naming the sets and an example', async () => {
    writeSet('alpha', { one: 'id-1' })
    writeSet('beta', { one: 'id-2' })
    const run = setFromArgv(['content', '--set'], {
      root,
      example: 'pnpm hub:wipe content --set <set>',
    })
    await expect(run).rejects.toThrow(
      /--set needs the name of a fixture set — available: alpha, beta/,
    )
    await expect(
      setFromArgv(['--set'], { root, example: 'pnpm hub:wipe content --set <set>' }),
    ).rejects.toThrow(/pnpm hub:wipe content --set alpha/)
  })

  it('never falls back to a default for a bare --set without a terminal', async () => {
    writeSet('alpha', { one: 'id-1' })
    await expect(setFromArgv(['--set'], { root, fallback: 'alpha' })).rejects.toThrow(/--set needs/)
  })
})
