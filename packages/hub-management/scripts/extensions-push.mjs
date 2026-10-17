#!/usr/bin/env node
/**
 * extensions:push — install public Workforce extensions on the active hub
 * (ADR-0023).
 *
 * Usage:
 *   pnpm extensions:push                  every entry in the catalogue
 *   pnpm extensions:push "<label>"        just one, matched on its exact label
 *   [--version <v>]                       pin a release the entry knows about
 *   [--dir <path>]                        default: packages/hub-management/workforce-extensions
 *   [--dry-run]                           print the plan, send nothing
 *
 * A flow binds to an *instance* of an extension, so a hub that has never had
 * one installed has nothing for the flow to bind to. `flows:push` calls the
 * same logic; this command exists for setting a hub up before any flow exists.
 *
 * ⚠️ Already installed means **any** instance of that extension, matched on the
 * `extensionId` rather than the label — the label is whatever the last person
 * typed. Nothing is ever updated or removed here; a second instance of the same
 * extension is a decision for a human, not a seed.
 *
 * All the rules live in lib/extensions.mjs; this script owns only the
 * round-trips.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { installInput, mergeCatalogue, parseEntry, resolveEnv } from './lib/extensions.mjs'
import { LOCAL_DIR } from './lib/fixtures.mjs'
import {
  cmsHubId,
  graphql,
  managementToken,
  organizationOf,
  personalAccessToken,
  readRegistry,
  requiredEnv,
} from './lib/workforce-api.mjs'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const argv = process.argv.slice(2)
const optionAfter = (name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}
const dir = optionAfter('--dir') ?? path.join(packageRoot, 'workforce-extensions')
const version = optionAfter('--version')
const dryRun = argv.includes('--dry-run')
const only = argv.find((arg) => !arg.startsWith('--') && arg !== dir && arg !== version)

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

const report = (error) => fail(error instanceof Error ? error.message : String(error))
process.on('unhandledRejection', report)
process.on('uncaughtException', report)

const INSTALL = `mutation install($input: CreateExtensionInstanceInput!) {
  createExtensionInstance(input: $input) { id label }
}`

/** The entries in one directory, each tagged with the file it came from. */
function readDir(from) {
  if (!existsSync(from)) return []
  return readdirSync(from)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      source: path.join(path.basename(from), name),
      value: parseEntry(JSON.parse(readFileSync(path.join(from, name), 'utf8')), name),
    }))
}

/** The checked-in catalogue plus the gitignored `local/` one. */
export function readCatalogue(from) {
  return mergeCatalogue(readDir(from), readDir(path.join(from, LOCAL_DIR)))
}

const catalogue = readCatalogue(dir)
const named = only === undefined ? catalogue : catalogue.filter((entry) => entry.label === only)

if (catalogue.length === 0) {
  fail(`No catalogue entries in ${path.relative(process.cwd(), dir)}.`)
}
if (named.length === 0) {
  fail(`No entry labelled "${only}". Available: ${catalogue.map((e) => e.label).join(', ')}`)
}

// ⚠️ Asked for one by name, say why it cannot be installed rather than printing
// "nothing to install" — the entry exists, which is the confusing part.
if (only !== undefined && named.every((entry) => !entry.installable)) {
  fail(
    `"${only}" is catalogued but marked "installable": false. Its id is recorded so flows ` +
      `resolve against it, but this repo has no install recipe for it — no pinned releases, or ` +
      `credentials it does not hold. Install it on the hub by hand.`,
  )
}

const wanted = named.filter((entry) => entry.installable)
const recordOnly = named.filter((entry) => !entry.installable)

const token = personalAccessToken()
const hubId = requiredEnv('AMPLIENCE_HUB_ID', 'identify the hub to install on')
const hubName = process.env.AMPLIENCE_HUB_NAME?.trim()
const mgmtToken = await managementToken()
const organizationId = await organizationOf(mgmtToken, hubId)
const hubRef = cmsHubId(organizationId, hubId)

const { registry } = await readRegistry(token, mgmtToken, hubId, organizationId)
const installed = new Set(registry.extensionInstances.map((instance) => instance.extensionId))

console.log(`\n→ Workforce extensions on hub ${hubName ?? hubId}${dryRun ? ' (dry run)' : ''}`)

// Listed, not hidden: their ids still do work during flow resolution, so
// someone reading this output should know they were considered.
for (const entry of recordOnly) {
  console.log(`  · ${entry.label}  (id catalogued for resolution — not installable from here)`)
}

const plan = []
for (const entry of wanted) {
  if (installed.has(entry.extensionId)) {
    const existing = registry.extensionInstances.find((i) => i.extensionId === entry.extensionId)
    console.log(`  = ${entry.label}  (already installed as "${existing?.label ?? existing?.id}")`)
    continue
  }
  // Resolved before anything is sent, so a missing secret stops the run rather
  // than leaving half the catalogue installed.
  const env = resolveEnv(entry.env, { env: process.env, hubId, hubName, source: entry.label })
  plan.push({ entry, input: installInput(entry, { version, hubRef, env }) })
  console.log(`  + ${entry.label}${version === undefined ? '' : ` (v${version})`}`)
}

if (plan.length === 0) {
  console.log('  Nothing to install.\n')
  process.exit(0)
}

if (dryRun) {
  for (const { input } of plan) {
    // Values are resolved by now, so only the keys are printed.
    const safe = { ...input, env: Object.fromEntries(Object.keys(input.env).map((k) => [k, '…'])) }
    console.log(`\n  ${JSON.stringify(safe, null, 2).split('\n').join('\n  ')}`)
  }
  console.log('\n  Dry run — nothing was sent.\n')
  process.exit(0)
}

for (const { entry, input } of plan) {
  const data = await graphql(token, INSTALL, { input })
  const made = data?.createExtensionInstance
  console.log(`  ✓ ${entry.label} → ${made?.label ?? ''} ${made?.id ?? ''}`)
}

console.log(`\n✓ ${plan.length} installed on ${hubName ?? hubId}.\n`)
