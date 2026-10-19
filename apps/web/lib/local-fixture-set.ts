/**
 * Gitignored fixture sets (`packages/content/fixtures/local/<name>/`) for the
 * mock client.
 *
 * Registered sets are static imports so the mock runs in any runtime; a local
 * set can't be imported without naming it in tracked code, so this reads it
 * from disk instead. Server-only, and only reached when FIXTURE_SET names a set
 * the registry doesn't have — a deployment never carries a local set.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { EnrichedContentItem } from '@amplience/frontend-starter-content'
import type { FixtureSet, HierarchyManifest } from '@amplience/frontend-starter-content/mock'

/** Directories inside a set that hold content items — mirrors the seed scripts. */
const ITEM_DIRS = ['components', 'slots', 'pages', 'site-components']

const LOCAL_FROM_ROOT = path.join('packages', 'content', 'fixtures', 'local')

/** `fixtures/local/`, found by walking up from the working directory. */
export const findLocalFixturesRoot = (from: string = process.cwd()): string | undefined => {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, LOCAL_FROM_ROOT)
    if (existsSync(candidate)) return candidate
    if (path.dirname(dir) === dir) return undefined
  }
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))

const jsonFilesUnder = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) return jsonFilesUnder(abs)
    return entry.name.endsWith('.json') ? [abs] : []
  })
}

/** The local set called `name`, or undefined when there isn't one. */
export const loadLocalFixtureSet = (
  name: string,
  root: string | undefined = findLocalFixturesRoot(),
): FixtureSet | undefined => {
  if (root === undefined) return undefined
  const dir = path.join(root, name)
  if (!existsSync(path.join(dir, 'set.json'))) return undefined

  const fixtures = ITEM_DIRS.flatMap((d) => jsonFilesUnder(path.join(dir, d))).map(
    (file) => readJson(file) as EnrichedContentItem,
  )
  const manifests = path.join(dir, '_hierarchy', 'manifests.json')
  const hierarchies = existsSync(manifests)
    ? (readJson(manifests) as Record<string, HierarchyManifest>)
    : {}

  return { name, fixtures, hierarchies }
}
