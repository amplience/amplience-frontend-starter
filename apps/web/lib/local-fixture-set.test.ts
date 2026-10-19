import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findLocalFixturesRoot, loadLocalFixtureSet } from './local-fixture-set'

let repo: string
let root: string

const write = (rel: string, value: unknown) => {
  const file = path.join(root, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value))
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'local-sets-'))
  root = path.join(repo, 'packages', 'content', 'fixtures', 'local')
  mkdirSync(root, { recursive: true })
})
afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('loadLocalFixtureSet', () => {
  it('finds local/ from anywhere below the repository root', () => {
    mkdirSync(path.join(repo, 'apps', 'web'), { recursive: true })
    expect(findLocalFixturesRoot(path.join(repo, 'apps', 'web'))).toBe(root)
  })

  it('reads every item directory, nested folders included, plus the hierarchy', () => {
    write('demo/set.json', { name: 'demo' })
    write('demo/pages/home.json', { id: 'p', body: { _meta: { schema: 's' } } })
    write('demo/components/header/logo.json', { id: 'c', body: { _meta: { schema: 's' } } })
    write('demo/site-components/custom-css.json', { id: 'css', body: { _meta: { schema: 's' } } })
    write('demo/notes/ignored.json', { id: 'x' })
    write('demo/_hierarchy/manifests.json', { 'demo/site/menu': { root: 'r', children: {} } })

    const set = loadLocalFixtureSet('demo', root)
    expect(set?.name).toBe('demo')
    expect(set?.fixtures.map((f) => f.id).sort()).toEqual(['c', 'css', 'p'])
    expect(Object.keys(set?.hierarchies ?? {})).toEqual(['demo/site/menu'])
  })

  it('is undefined for a directory without a set.json, or no local/ at all', () => {
    mkdirSync(path.join(root, 'nope'))
    expect(loadLocalFixtureSet('nope', root)).toBeUndefined()
    expect(loadLocalFixtureSet('demo', undefined)).toBeUndefined()
  })
})
