#!/usr/bin/env node
/**
 * flows:push — resolve a flow fixture against the active hub and create or
 * update it there (ADR-0023).
 *
 * Usage:
 *   pnpm flows:push                  push every fixture in flows/
 *   pnpm flows:push "<label>"        push one, matched on its exact label
 *   [--dir <path>]                   default: packages/hub-management/flows,
 *                                    plus its gitignored local/ subdirectory
 *   [--dry-run]                      resolve, print the payload, send nothing
 *
 * ⚠️ Run `listeners:push` first. A flow's `${listener:…}` resolves against the
 * listeners seeded there, and resolution refuses rather than guessing.
 *
 * **An unresolved token aborts the whole push and writes nothing**, including
 * the fixtures already resolved in the same run. A half-pushed set is harder to
 * reason about than a refused one, and a flow that imports cleanly and dies at
 * run time is the outcome this is all designed to avoid.
 *
 * All the rules live in lib/flows.mjs; this script owns only the round-trips.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  catalogueIndex,
  findEntry,
  installInput,
  mergeCatalogue,
  missingExtensions,
  parseEntry,
  resolveEnv,
} from './lib/extensions.mjs'
import { LOCAL_DIR, mergeFixtures } from './lib/fixtures.mjs'
import {
  clearReviewers,
  createFlowInput,
  handleOf,
  planPush,
  resolveGraph,
  updateFlowInput,
} from './lib/flows.mjs'
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

// ── Arguments ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const optionAfter = (name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}
const dir = optionAfter('--dir') ?? path.join(packageRoot, 'flows')
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

/** The API's maximum; asking for more is refused outright, not clamped. */
const PAGE_SIZE = 50

const FLOWS_QUERY = `query flows($hubId: ID!, $first: Int!, $after: String) {
  cmsHub(id: $hubId) {
    contentFlows(first: $first, after: $after) {
      edges { node { id label status updatedDate } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`

const LISTENER_QUERY = `query listener($id: ID!) {
  webhookListener(id: $id) { id label schema }
}`

const INSTALL = `mutation install($input: CreateExtensionInstanceInput!) {
  createExtensionInstance(input: $input) { id label }
}`

const CREATE = `mutation create($input: CreateContentFlowInput!) {
  createContentFlow(input: $input) { id label }
}`

const UPDATE = `mutation update($input: UpdateContentFlowInput!) {
  updateContentFlow(input: $input) { id label }
}`

/** Every flow on the hub. `contentFlows` is a Relay connection, so it pages. */
async function readFlows(token, hubRef) {
  const flows = []
  let after
  do {
    const page = (await graphql(token, FLOWS_QUERY, { hubId: hubRef, first: PAGE_SIZE, after }))
      ?.cmsHub?.contentFlows
    for (const edge of page?.edges ?? []) if (edge?.node != null) flows.push(edge.node)
    after = page?.pageInfo?.hasNextPage === true ? page.pageInfo.endCursor : undefined
  } while (after !== undefined)
  return flows
}

/**
 * Fill in each listener's schema, which the list query does not carry.
 *
 * Only for the listeners a fixture's trigger actually binds — the schema is
 * replayed into the trigger declaration, and reading every listener on the hub
 * to find out would be one round trip per listener nobody referenced.
 */
async function withListenerSchemas(token, listeners, needed) {
  const filled = []
  for (const listener of listeners) {
    if (!needed.has(listener.label)) {
      filled.push(listener)
      continue
    }
    const full = (await graphql(token, LISTENER_QUERY, { id: listener.id }))?.webhookListener
    filled.push({ ...listener, ...(full ?? {}) })
  }
  return filled
}

/** One directory's fixtures, as merge entries. */
function readDir(from) {
  if (!existsSync(from)) return []
  return readdirSync(from)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const source = path.relative(process.cwd(), path.join(from, name))
      const value = { name, ...JSON.parse(readFileSync(path.join(from, name), 'utf8')) }
      return { label: value.label, source, value }
    })
}

/** Checked-in fixtures and locally-pulled ones, refusing a label in both. */
function readFixtures() {
  return mergeFixtures(readDir(dir), readDir(path.join(dir, LOCAL_DIR))).map((e) => e.value)
}

/**
 * The catalogue of extension ids known to be the same on every hub.
 *
 * Two jobs, and they are not the same job: it is the install recipe for the
 * entries that have one, and — for every entry, recipe or not — it is what
 * tells resolution that a missing id means "not installed here" rather than
 * "this id was never going to match anywhere else".
 */
function readCatalogue() {
  const base = path.join(packageRoot, 'workforce-extensions')
  const readDir = (from) =>
    !existsSync(from)
      ? []
      : readdirSync(from)
          .filter((name) => name.endsWith('.json'))
          .map((name) => ({
            source: path.join(path.basename(from), name),
            value: parseEntry(JSON.parse(readFileSync(path.join(from, name), 'utf8')), name),
          }))
  return mergeCatalogue(readDir(base), readDir(path.join(base, LOCAL_DIR)))
}

/** The labels a fixture's `${listener:…}` tokens name. */
function listenersReferenced(fixtures) {
  const labels = new Set()
  for (const fixture of fixtures) {
    for (const action of fixture.flow?.actions ?? []) {
      const token = action?.config?.['amp:webhookId']
      const match = typeof token === 'string' ? /^\$\{listener:([^}]*)\}$/.exec(token) : null
      if (match !== null) labels.add(match[1].trim())
    }
  }
  return labels
}

// ── Main ──────────────────────────────────────────────────────────────────────

const fixtures = readFixtures()
const desired = only === undefined ? fixtures : fixtures.filter((f) => f.label === only)

if (fixtures.length === 0) {
  console.log(`\n→ No flow fixtures in ${path.relative(process.cwd(), dir)} — nothing to push.\n`)
  process.exit(0)
}
if (desired.length === 0) {
  fail(`No flow fixture labelled "${only}". Available: ${fixtures.map((f) => f.label).join(', ')}`)
}

const token = personalAccessToken()
const hubId = requiredEnv('AMPLIENCE_HUB_ID', 'identify the hub to push to')
const hubName = process.env.AMPLIENCE_HUB_NAME?.trim()
const mgmtToken = await managementToken()
const organizationId = await organizationOf(mgmtToken, hubId)
const hubRef = cmsHubId(organizationId, hubId)

const { registry, warnings: registryWarnings } = await readRegistry(
  token,
  mgmtToken,
  hubId,
  organizationId,
)
registry.listeners = await withListenerSchemas(
  token,
  registry.listeners,
  listenersReferenced(desired),
)

// A flow binds to an instance of an extension, so a hub that has never had one
// installed has nothing to bind to. Installing from the catalogue turns that
// refusal into a step — but only for an extension the catalogue knows; anything
// else still refuses, in resolveGraph, with a message naming what it wanted.
const missing = missingExtensions(desired, registry.extensionInstances)
const catalogue = readCatalogue()
// An entry marked `installable: false` is deliberately skipped here. Its id is
// catalogued so resolution knows the id is stable, but there is no recipe to
// install it — so resolveGraph refuses below with a message that says to do it
// by hand, rather than this step failing halfway through a mutation.
const installable = missing
  .map((want) => ({ ...want, entry: findEntry(catalogue, want.extensionId) }))
  .filter((want) => want.entry !== undefined && want.entry.installable)

if (installable.length > 0) {
  console.log(`\n→ Extensions this flow needs that ${hubName ?? hubId} has not got`)
  for (const want of installable) {
    console.log(`  + ${want.entry.label}${want.version === undefined ? '' : ` (v${want.version})`}`)
  }
  if (dryRun) {
    console.log(
      `\n  Dry run — these would be installed first. Run \`pnpm extensions:push\` to do it ` +
        `separately, or re-run this without --dry-run.\n`,
    )
    process.exit(0)
  }
  for (const want of installable) {
    const env = resolveEnv(want.entry.env, {
      env: process.env,
      hubId,
      hubName,
      source: want.entry.label,
    })
    await graphql(token, INSTALL, {
      input: installInput(want.entry, { version: want.version, hubRef, env }),
    })
    console.log(`  ✓ installed ${want.entry.label}`)
  }
  // Re-read, so resolution sees what was just installed.
  registry.extensionInstances = (
    await readRegistry(token, mgmtToken, hubId, organizationId)
  ).registry.extensionInstances
}

const existing = await readFlows(token, hubRef)

// ⚠️ The catalogue's second job. A catalogued id is one we assert means the
// same extension on every hub, so if it is absent here the extension is simply
// not installed — nothing else explains it. An *un*catalogued id that misses
// proves nothing, because a PRIVATE extension re-created on another hub is a
// different record with a different id, so resolution falls back to the label.
const index = catalogueIndex(catalogue)

// Everything is resolved and planned before anything is sent, so a fixture that
// cannot resolve stops the run rather than leaving half a set pushed.
const prepared = desired.map((fixture) => {
  const { flow, warnings } = resolveGraph(fixture, registry, {
    hub: hubName ?? hubId,
    catalogue: index,
  })
  const { flow: ready, cleared } = clearReviewers(flow)
  return { fixture, flow: ready, warnings, cleared, plan: planPush(fixture.label, existing) }
})

console.log(`\n→ Flows on hub ${hubName ?? hubId}${dryRun ? ' (dry run)' : ''}`)
for (const { fixture, plan, cleared } of prepared) {
  console.log(
    `  ${plan.mode === 'create' ? '+' : '~'} ${fixture.label}` +
      (plan.mode === 'update' ? ` → ${plan.id}` : '') +
      (cleared > 0 ? `  (${cleared} review step${cleared === 1 ? '' : 's'} cleared)` : ''),
  )
}

for (const warning of [...registryWarnings, ...prepared.flatMap((p) => p.warnings)]) {
  console.warn(`\n⚠ ${warning}`)
}

if (dryRun) {
  // What resolution had to match against. On a hub where a fixture refuses,
  // this is usually the answer, so it is worth printing before the payloads.
  const handles = registry.extensionInstances.map(handleOf).sort()
  console.log(
    `\n  Hub registry: ${handles.length} extension instance(s), ` +
      `${registry.listeners.length} listener(s), ${registry.workflowStates.length} workflow state(s)`,
  )
  for (const handle of handles) console.log(`    · ${handle}`)

  for (const { fixture, flow, plan } of prepared) {
    const input =
      plan.mode === 'create'
        ? createFlowInput(fixture, flow, hubRef)
        : updateFlowInput(fixture, flow, plan.id)
    console.log(`\n  ${plan.mode === 'create' ? CREATE : UPDATE}`)
    console.log(
      `  input: ${JSON.stringify(
        { ...input, flow: `<${input.flow.length} chars of JSON>` },
        null,
        2,
      )
        .split('\n')
        .join('\n  ')}`,
    )
    console.log(
      `  ${flow.actions?.length ?? 0} actions, ${flow.edges?.length ?? 0} edges, ` +
        `${flow.virtualActions?.length ?? 0} action types declared`,
    )
  }
  console.log('\n  Dry run — nothing was sent.\n')
  process.exit(0)
}

let created = 0
let updated = 0
for (const { fixture, flow, plan } of prepared) {
  if (plan.mode === 'create') {
    await graphql(token, CREATE, { input: createFlowInput(fixture, flow, hubRef) })
    created += 1
  } else {
    await graphql(token, UPDATE, { input: updateFlowInput(fixture, flow, plan.id) })
    updated += 1
  }
}

console.log(`\n✓ ${created} created, ${updated} updated on ${hubName ?? hubId}.\n`)
