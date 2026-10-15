#!/usr/bin/env node
/**
 * listeners:push — seed Workforce webhook listeners on the active hub (ADR-0023).
 *
 * Usage:
 *   pnpm listeners:push              seed every fixture in webhook-listeners/
 *   pnpm listeners:push <label>      seed one, matched on its exact label
 *   [--dir <path>]                   default: packages/hub-management/webhook-listeners,
 *                                    plus its gitignored local/ subdirectory
 *   [--dry-run]                      print the plan and change nothing
 *
 * Runs **before** flows, which reference listeners by label: a flow's
 * `${listener:Label}` resolves to the id this step created or found.
 *
 * ⚠️ Listeners are never pruned and never downgraded. A listener this tooling
 * did not create may have external callers pointed at its URL, and one that is
 * protected cannot be re-seeded without its secret — which the API does not
 * hand back. Both cases are reported and skipped.
 *
 * All the rules live in lib/listeners.mjs; this script owns only the
 * round-trips.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOCAL_DIR, mergeFixtures } from './lib/fixtures.mjs'
import { createInput, diffListeners, parseFixture, updateInput } from './lib/listeners.mjs'
import {
  cmsHubId,
  graphql,
  managementToken,
  organizationOf,
  personalAccessToken,
  readListeners,
  requiredEnv,
} from './lib/workforce-api.mjs'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// ── Arguments ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const optionAfter = (name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}
const dir = optionAfter('--dir') ?? path.join(packageRoot, 'webhook-listeners')
const dryRun = argv.includes('--dry-run')
const only = argv.find((arg) => !arg.startsWith('--') && arg !== dir)

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

const report = (error) => fail(error instanceof Error ? error.message : String(error))
process.on('unhandledRejection', report)
process.on('uncaughtException', report)

// ── Reads and writes ──────────────────────────────────────────────────────────

/** The list query carries no `security`, so matched listeners are read singly. */
const READ_QUERY = `query listener($id: ID!) {
  webhookListener(id: $id) { id label schema security { __typename } }
}`

const CREATE = `mutation create($input: CreateWebhookListenerInput!) {
  createWebhookListener(input: $input) { id label url }
}`

const UPDATE = `mutation update($input: UpdateWebhookListenerInput!) {
  updateWebhookListener(input: $input) { id label url }
}`

/** One directory's fixtures, as merge entries. */
function readDir(from) {
  if (!existsSync(from)) return []
  return readdirSync(from)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const source = path.relative(process.cwd(), path.join(from, name))
      const value = parseFixture(JSON.parse(readFileSync(path.join(from, name), 'utf8')), source)
      return { label: value.label, source, value }
    })
}

/** Checked-in fixtures and locally-pulled ones, refusing a label in both. */
function readFixtures() {
  return mergeFixtures(readDir(dir), readDir(path.join(dir, LOCAL_DIR))).map((e) => e.value)
}

/**
 * The hub's listeners, with `security` filled in for the ones a fixture claims.
 *
 * Only those are read in full: the second query is per listener, and whether a
 * listener nobody authored is protected is not this step's business.
 */
async function readWithSecurity(token, hubRef, wanted) {
  const listed = (await readListeners(token, hubRef)).filter(
    (node) => typeof node?.id === 'string' && typeof node.label === 'string',
  )

  const detailed = []
  for (const node of listed) {
    if (!wanted.has(node.label)) continue
    const full = await graphql(token, READ_QUERY, { id: node.id })
    detailed.push({ ...node, ...(full?.webhookListener ?? {}) })
  }
  return detailed
}

// ── Main ──────────────────────────────────────────────────────────────────────

const fixtures = readFixtures()
const desired = only === undefined ? fixtures : fixtures.filter((f) => f.label === only)

if (fixtures.length === 0) {
  console.log(
    `\n→ No listener fixtures in ${path.relative(process.cwd(), dir)} — nothing to seed.\n`,
  )
  process.exit(0)
}
if (desired.length === 0) {
  fail(
    `No listener fixture labelled "${only}". Available: ${fixtures.map((f) => f.label).join(', ')}`,
  )
}

const token = personalAccessToken()
const hubId = requiredEnv('AMPLIENCE_HUB_ID', 'identify the hub to seed')
const mgmtToken = await managementToken()
const hubRef = cmsHubId(await organizationOf(mgmtToken, hubId), hubId)

const existing = await readWithSecurity(token, hubRef, new Set(desired.map((f) => f.label)))
const plan = diffListeners(desired, existing)

console.log(`\n→ Webhook listeners on hub ${hubId}${dryRun ? ' (dry run)' : ''}`)
for (const listener of plan.create) console.log(`  + ${listener.label}`)
for (const listener of plan.update) console.log(`  ~ ${listener.label}`)
for (const listener of plan.unchanged) console.log(`  = ${listener.label}`)
if (plan.create.length + plan.update.length === 0 && plan.refused.length === 0) {
  console.log('  Nothing to do.')
}

const seeded = [...plan.unchanged]

if (!dryRun) {
  for (const listener of plan.create) {
    const data = await graphql(token, CREATE, { input: createInput(listener, hubRef) })
    seeded.push({ ...listener, ...(data?.createWebhookListener ?? {}) })
  }
  for (const listener of plan.update) {
    const data = await graphql(token, UPDATE, { input: updateInput(listener) })
    seeded.push({ ...listener, ...(data?.updateWebhookListener ?? {}) })
  }
}

// The inbound URL is minted by Amplience and cannot be authored ahead of time,
// so it is printed: it is the one thing an external caller actually needs.
if (seeded.length > 0) {
  console.log('\n  Inbound URLs:')
  for (const listener of seeded) {
    console.log(`    ${listener.label}\n      ${listener.url ?? '(not returned)'}`)
  }
}

for (const { reason } of plan.refused) console.warn(`\n⚠ ${reason}`)

console.log(
  dryRun
    ? '\n  Dry run — nothing was changed.\n'
    : `\n✓ ${plan.create.length} created, ${plan.update.length} updated, ` +
        `${plan.unchanged.length} already current, ${plan.refused.length} refused.\n`,
)

if (plan.refused.length > 0) process.exit(1)
