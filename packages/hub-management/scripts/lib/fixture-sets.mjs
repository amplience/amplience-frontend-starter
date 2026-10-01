/**
 * Finding and choosing a fixture set, shared by the import and wipe scripts so
 * the two can't disagree about what a set is or which one is in play.
 *
 * Sets are discovered from disk rather than declared here: a directory under
 * `packages/content/fixtures/` holding a `set.json` is a set. The TypeScript
 * registry in `packages/content/src/mock/loader.ts` is the runtime's list; these
 * scripts are plain ESM and can't import it, so disk is the shared truth and the
 * guard test in the content package holds the two in step.
 *
 * Plain ESM so `node scripts/*.mjs` can import it without a TS loader;
 * `fixture-sets.d.mts` gives the .ts tests real types.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// scripts/lib/<this file> → up three to the package root.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Where the sets live. */
export const fixturesRoot = path.join(packageRoot, '..', 'content', 'fixtures')

/**
 * The set seeded when nothing says otherwise — the twin of `FIXTURE_SITE_NAME`
 * in `packages/content/src/config.ts`, which is what a zero-config deployment
 * reads. Duplicated rather than imported because that file is TypeScript; a
 * mismatch surfaces immediately, because the set has to exist on disk.
 */
export const DEFAULT_FIXTURE_SET = 'frontend-starter'

/** Directories inside a set that hold content items, in seed order. */
export const ITEM_DIRS = ['components', 'slots', 'pages', 'site-components']

/** Every set on disk, sorted. `root` is for tests; production uses the default. */
export const availableSets = (root = fixturesRoot) =>
  readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(root, e.name, 'set.json')))
    .map((e) => e.name)
    .sort()

/** Every `*.json` under `dir`, recursively, relative to `from`. */
const jsonFilesUnder = (dir, from) => {
  let out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out // an optional phase directory this set doesn't use
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out = out.concat(jsonFilesUnder(abs, from))
    else if (entry.name.endsWith('.json')) out.push(path.relative(from, abs))
  }
  return out
}

/**
 * A set, with the ids of every item in it.
 *
 * The ids are read from the files rather than re-derived from their paths: what
 * was seeded is what the files said at the time, and reading keeps this honest
 * if a stamping run is ever pending.
 */
export const readSet = (name, root = fixturesRoot) => {
  const dir = path.join(root, name)
  const definition = JSON.parse(readFileSync(path.join(dir, 'set.json'), 'utf8'))

  // The directory name is the set's identity — it's the delivery-key prefix on
  // every item inside. A `set.json` claiming a different name means the two
  // disagree about what this set is, and everything downstream (namespacing,
  // classification, the registry) would pick a side silently.
  if (definition.name !== name) {
    throw new Error(
      `Fixture set directory "${name}" holds a set.json naming "${definition.name}".\n` +
        '  The directory name is the set name and the delivery-key prefix — rename one to match.',
    )
  }

  const ids = new Set()
  for (const itemDir of ITEM_DIRS) {
    for (const rel of jsonFilesUnder(path.join(dir, itemDir), dir)) {
      const item = JSON.parse(readFileSync(path.join(dir, rel), 'utf8'))
      if (typeof item.id === 'string') ids.add(item.id)
    }
  }
  return { name, dir, definition, ids }
}

/** Every set on disk, read. */
export const readAllSets = (root = fixturesRoot) =>
  availableSets(root).map((name) => readSet(name, root))

/**
 * Which set a command is about.
 *
 * Throws rather than exiting so the caller owns how it reports — and so this
 * stays testable. `fallback` is separate from the default so a prompt can be
 * slotted in ahead of it without changing anything here.
 */
export const resolveSetName = (requested, { fallback = DEFAULT_FIXTURE_SET, root } = {}) => {
  const available = availableSets(root)
  const name = requested ?? fallback
  if (!available.includes(name)) {
    throw new Error(
      `Unknown fixture set "${name}" — available: ${available.join(', ')}.\n` +
        'Pass --set <name>, or set FIXTURE_SET.',
    )
  }
  return name
}

/** `--flag value` or `--flag=value`, anywhere in `argv`. */
export const flagValue = (argv, name) => {
  const i = argv.indexOf(name)
  if (i !== -1) return argv[i + 1]
  const inline = argv.find((a) => a.startsWith(`${name}=`))
  return inline?.slice(name.length + 1)
}

/** Is a bare `--flag` present? */
export const hasFlag = (argv, name) => argv.includes(name)

/** The first bare argument, skipping flags and any value that follows `--set`. */
export const positional = (argv) => {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      if (arg === '--set') i++ // its value, not a scope
      continue
    }
    return arg
  }
  return undefined
}
