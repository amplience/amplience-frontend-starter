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

/**
 * Ask which set to use, when there is genuinely a choice to make.
 *
 * Stays quiet unless all three hold: a terminal is attached, more than one set
 * exists, and none was named. The Environment Manager spawns these scripts and
 * CI runs them, and a prompt neither can answer hangs forever — so the absence
 * of a TTY is treated as "take the default", not "wait".
 */
export const promptForSet = async (
  available,
  fallback,
  { question = 'Which fixture set do you want to use for the content?', always = false } = {},
) => {
  if (!process.stdin.isTTY) return undefined
  // A lone set is only worth asking about when the person explicitly asked to
  // choose (a bare `--set`) — otherwise there is nothing to choose between.
  if (!always && available.length < 2) return undefined

  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log(`\n${question}`)
    available.forEach((name, i) => {
      console.log(`  ${i + 1}) ${name}${name === fallback ? '  (default)' : ''}`)
    })
    const range = `1-${available.length}`
    const hint =
      fallback === undefined ? `Choose ${range}: ` : `Choose ${range}, or Enter for the default: `
    const answer = (await rl.question(hint)).trim().toLowerCase()
    if (answer === '') return undefined
    const byNumber = available[Number(answer) - 1]
    if (byNumber !== undefined) return byNumber
    if (available.includes(answer)) return answer
    console.log(
      `  "${answer}" isn't one of those` + (fallback === undefined ? '.' : ' — using the default.'),
    )
    return undefined
  } finally {
    rl.close()
  }
}

/**
 * The set a command will act on: what was asked for, else what the environment
 * says, else what a person at a terminal picks, else the default.
 */
export const chooseSet = async (requested, { fallback = DEFAULT_FIXTURE_SET, root } = {}) => {
  if (requested !== undefined) return resolveSetName(requested, { fallback, root })
  const picked = await promptForSet(availableSets(root), fallback)
  return resolveSetName(picked, { fallback, root })
}

/**
 * A `--flag value` / `--flag=value` option, telling "absent" apart from "given
 * with no value". A bare `--set` (last argument, followed by another `--flag`,
 * or `--set=`) has to be caught: read as absent, `hub:wipe content --set` would
 * be a blanket content wipe, and `hub:wipe --set` a wipe of the whole hub.
 */
export const readFlag = (argv, name) => {
  const i = argv.indexOf(name)
  if (i !== -1) {
    const next = argv[i + 1]
    const value = next === undefined || next.startsWith('--') || next === '' ? undefined : next
    return { present: true, value }
  }
  const inline = argv.find((a) => a.startsWith(`${name}=`))
  if (inline === undefined) return { present: false, value: undefined }
  const value = inline.slice(name.length + 1)
  return { present: true, value: value === '' ? undefined : value }
}

/** `--flag value` or `--flag=value`, anywhere in `argv`; undefined if absent or bare. */
export const flagValue = (argv, name) => readFlag(argv, name).value

/**
 * The set a `--set` flag names — asking for one when it was given bare.
 *
 * Resolves to undefined only when `--set` wasn't passed at all, so the caller
 * keeps its own fallback for that case. A bare `--set` is someone asking to
 * choose: at a terminal they're asked (with `fallback` offered as the Enter
 * default, when there is one); anywhere else — CI, the Environment Manager —
 * there's no one to ask, so it throws naming the sets and an example. It never
 * silently falls back, because for a wipe "no set" means "everything".
 */
export const setFromArgv = async (argv, { example, question, fallback, root } = {}) => {
  const flag = readFlag(argv, '--set')
  if (!flag.present) return undefined
  if (flag.value !== undefined) return flag.value

  const available = availableSets(root)
  const picked = await promptForSet(available, fallback, { question, always: true })
  if (picked !== undefined) return picked
  if (fallback !== undefined && process.stdin.isTTY) return fallback

  throw new Error(
    `--set needs the name of a fixture set — available: ${available.join(', ')}.\n` +
      (example === undefined
        ? ''
        : `  e.g. ${example.replace('<set>', available[0] ?? '<set>')}\n`) +
      (process.stdin.isTTY
        ? '  Nothing was chosen, so nothing has been done.'
        : '  Nothing has been done.'),
  )
}

/** Is a bare `--flag` present? */
export const hasFlag = (argv, name) => argv.includes(name)

/** The first bare argument, skipping flags and any value that follows `--set`. */
export const positional = (argv) => {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      // Its value, not a scope — unless it's bare, and the next word is a flag.
      if (arg === '--set' && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) i++
      continue
    }
    return arg
  }
  return undefined
}
