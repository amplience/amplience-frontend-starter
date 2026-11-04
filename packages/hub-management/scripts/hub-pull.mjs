#!/usr/bin/env node
/**
 * hub:pull:content — turn a site on a hub into a local fixture set.
 *
 * Usage:
 *   pnpm hub:pull:content --set <new-set> [--from <site>]
 *     --set <name>             the set to create, under fixtures/local/ (gitignored)
 *     --from <site>            the delivery-key namespace to pull; defaults to SITE_NAME
 *     --label <text>           set.json label (default: from the set name)
 *     --default-locale <code>  set.json defaultLocale (default: the most-authored)
 *     --dry-run                say what would be written, write nothing
 *     --force                  replace an existing local set of the same name
 *
 * Read-only against the hub: it lists the content, slots and site-components
 * repositories, follows links, and writes files. Nothing is imported,
 * published or changed on the hub.
 *
 * The set always lands in fixtures/local/, because content pulled from a hub
 * can be a customer's. Promoting it to a checked-in set (moving the directory
 * and registering it in packages/content/src/mock/sets/) is a deliberate act.
 *
 * Once written, `fixtures:ids` re-mints every id from its path, so seeding the
 * set back creates new items instead of touching the ones it came from.
 *
 * All the rules live in lib/content-pull.mjs; this script owns the round-trips.
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DynamicContent } from 'dc-management-sdk-js'

import { collectItems, planPull } from './lib/content-pull.mjs'
import {
  availableSets,
  fixturesRoot,
  flagValue,
  hasFlag,
  LOCAL_SETS_DIR,
  localSets,
  readSet,
} from './lib/fixture-sets.mjs'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const repoRoot = path.join(packageRoot, '..', '..')

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

const report = (error) => fail(error instanceof Error ? error.message : String(error))
process.on('unhandledRejection', report)
process.on('uncaughtException', report)

const env = (name) => {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

const requireEnv = (name, why) => env(name) ?? fail(`${name} is not set — needed to ${why}.`)

// ── Arguments ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const step = argv[0]?.startsWith('--') ? undefined : argv[0]
if (step !== 'content') fail(`Unknown step "${step ?? ''}" — only "content" can be pulled.`)

const SET_NAME = /^[a-z0-9][a-z0-9-]*$/
const to = flagValue(argv, '--set')
// Deliberately not FIXTURE_SET: that names the set already in use, and a pull
// into it would be a request to overwrite it.
if (to === undefined) fail('--set <name> is required — the name of the set to create.')
if (!SET_NAME.test(to))
  fail(`"${to}" can't be a set name — use lower-case letters, digits and hyphens.`)

const from = flagValue(argv, '--from') ?? env('SITE_NAME')
if (from === undefined)
  fail('Nothing says which site to pull — pass --from <site>, or set SITE_NAME.')

const dryRun = hasFlag(argv, '--dry-run')
const force = hasFlag(argv, '--force')

const existing = availableSets()
const isLocal = localSets().includes(to)
if (existing.includes(to) && !isLocal) {
  fail(`"${to}" is a checked-in set. Pull into a new name — a pull never overwrites a shared set.`)
}
if (isLocal && !force && !dryRun) {
  fail(`fixtures/${LOCAL_SETS_DIR}/${to} already exists. Pass --force to replace it.`)
}

// A site that is also a set on disk lends its brand, label and locale as defaults.
const sourceSet = existing.includes(from) ? readSet(from).definition : undefined

const hubId = requireEnv('AMPLIENCE_HUB_ID', 'identify the hub to read')
const clientId = requireEnv('AMPLIENCE_CLIENT_ID', 'read the hub')
const clientSecret = requireEnv('AMPLIENCE_CLIENT_SECRET', 'read the hub')
const repos = {
  content: requireEnv('AMPLIENCE_REPO_CONTENT', 'list the pages and components'),
  slots: requireEnv('AMPLIENCE_REPO_SLOTS', 'list the slots'),
  siteComponents: env('AMPLIENCE_REPO_SITE_COMPONENTS'),
}

// ── Reads ─────────────────────────────────────────────────────────────────────

const client = new DynamicContent({ client_id: clientId, client_secret: clientSecret })
const hub = await client.hubs.get(hubId)

console.log(
  `\n→ Pulling "${from}/" from hub "${hub.name}" into fixtures/${LOCAL_SETS_DIR}/${to}/` +
    `${dryRun ? ' (dry run)' : ''} — read-only on the hub`,
)

/** The SDK's HAL resources, reduced to the fields the rules read. */
const plain = (item) => ({
  id: item.id,
  label: item.label,
  locale: item.locale,
  status: item.status,
  contentRepositoryId: item.contentRepositoryId,
  hierarchy: item.hierarchy,
  body: item.body,
})

const listActive = async (repoId) => {
  const repo = await client.contentRepositories.get(repoId)
  const items = []
  for (let page = 0; ; page++) {
    const result = await repo.related.contentItems.list({ status: 'ACTIVE', size: 100, page })
    items.push(...result.getItems().map(plain))
    if (page >= (result.page?.totalPages ?? 1) - 1) break
  }
  return items
}

const candidates = []
for (const repoId of Object.values(repos).filter(Boolean))
  candidates.push(...(await listActive(repoId)))

const fetchItem = async (id) => {
  try {
    return plain(await client.contentItems.get(id))
  } catch (error) {
    const status = error?.response?.status ?? error?.status
    if (status === 404 || status === 403) return undefined
    throw error
  }
}

const { items, roots, missing, archived } = await collectItems(candidates, { from, fetchItem })
console.log(
  `  ${candidates.length} active items listed, ${roots} under "${from}/", ${items.length} in the site`,
)

if (roots === 0) fail(`No item on this hub has a delivery key under "${from}/". Check --from.`)

// ── Plan ──────────────────────────────────────────────────────────────────────

/** Content-type schema ids the starter ships; anything else neither seeds nor renders. */
const knownSchemas = () => {
  const dir = path.join(packageRoot, 'content-type-schemas', 'schemas')
  const ids = new Set()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const id = JSON.parse(readFileSync(path.join(dir, file), 'utf8')).$id
    if (typeof id === 'string' && !id.includes('/partials/')) ids.add(id)
  }
  return ids
}

const hubLocales = hub.settings?.localization?.locales ?? []
const plan = planPull(items, {
  from,
  to,
  repos,
  knownSchemas: knownSchemas(),
  hubLocales,
  defaultLocale: flagValue(argv, '--default-locale') ?? sourceSet?.defaultLocale,
  label: flagValue(argv, '--label'),
  description: `Pulled from the "${from}" site on hub "${hub.name}".`,
  defaultBrand: sourceSet?.defaultBrand,
})

const labelOf = new Map(items.map((item) => [item.id, item.label]))
for (const { from: holder, id } of missing) {
  plan.errors.push(`"${labelOf.get(holder)}" links to ${id}, which the hub doesn't have.`)
}
for (const { from: holder, id, label } of archived) {
  plan.errors.push(`"${labelOf.get(holder)}" links to "${label}" (${id}), which is archived.`)
}

for (const warning of plan.warnings) console.warn(`\n⚠ ${warning}`)
if (plan.errors.length > 0) {
  fail(
    `${plan.errors.length} problem(s) — nothing has been written:\n\n` +
      plan.errors.map((e) => `  · ${e}`).join('\n'),
  )
}

const tally = {}
for (const { path: rel } of plan.files)
  tally[rel.split('/')[0]] = (tally[rel.split('/')[0]] ?? 0) + 1
console.log(
  `  ${Object.entries(tally)
    .map(([dir, n]) => `${n} ${dir}`)
    .join(', ')}; ${Object.keys(plan.manifests).length} hierarchy manifest(s)`,
)
console.log(`  locales: ${plan.set.authoredLocales.join(', ')} (default ${plan.set.defaultLocale})`)
if (plan.endpoints.length > 0) {
  console.log(`  images stay on DAM endpoint(s): ${plan.endpoints.join(', ')}`)
}

if (dryRun) {
  for (const { path: rel } of plan.files) console.log(`    ${rel}`)
  console.log(`\n✓ Dry run — nothing written.\n`)
  process.exit(0)
}

// ── Write ─────────────────────────────────────────────────────────────────────

// Built beside the target and swapped in at the end, so a failure part-way
// leaves any existing set intact. The leading dot keeps it out of set discovery.
const localRoot = path.join(fixturesRoot, LOCAL_SETS_DIR)
const target = path.join(localRoot, to)
const building = path.join(localRoot, `.pull-${to}-${process.pid}`)
const writeJson = (rel, value) => {
  const file = path.join(building, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

try {
  for (const { path: rel, fixture } of plan.files) writeJson(rel, fixture)
  if (Object.keys(plan.manifests).length > 0) {
    writeJson(path.join('_hierarchy', 'manifests.json'), plan.manifests)
  }
  writeJson('set.json', plan.set)
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  renameSync(building, target)
} catch (error) {
  rmSync(building, { recursive: true, force: true })
  throw error
}

// Re-mint the hub ids from paths, so a seed creates new items rather than
// adopting the source ones.
const stamp = spawnSync(
  process.execPath,
  [path.join(repoRoot, 'packages', 'content', 'scripts', 'stamp-fixture-ids.mjs')],
  { stdio: 'inherit' },
)
if (stamp.status !== 0) {
  fail(
    `fixtures:ids failed — the set is written but still carries hub ids. Run \`pnpm fixtures:ids\`.`,
  )
}

console.log(`\n✓ ${plan.files.length} items → ${path.relative(repoRoot, target)}`)
console.log(`  Preview: FIXTURE_SET=${to} pnpm dev (restart next dev if it is already running)`)
console.log(`  Seed:    pnpm hub:import:content --set ${to}\n`)
