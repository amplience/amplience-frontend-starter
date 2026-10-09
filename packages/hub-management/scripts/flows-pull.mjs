#!/usr/bin/env node
/**
 * flows:pull — turn a Workforce flow into a checked-in fixture (ADR-0023).
 *
 * Usage:
 *   pnpm flows:pull <flowId>        pull from the active hub
 *   pnpm flows:pull --file <path>   tokenise a browser-extension export instead
 *   [--out <dir>]                   default: packages/hub-management/flows
 *
 * This is the authoring path. A flow tuned in the Workforce UI has to get back
 * into the repository, and without that the fixtures rot.
 *
 * ⚠️ Flows do NOT use the hub's client credentials — Workforce has no
 * machine-credential path, so the GraphQL calls need a personal access token.
 * The Environment Manager writes one into this package's .env when a hub is
 * activated; AMPLIENCE_PAT or FLOWS_CLI_TOKEN override it.
 *
 * The Management API is still used, for the two things GraphQL does not carry:
 * the hub's organization (half of the opaque Workforce hub id) and the
 * workflow-state labels that `${status:…}` is written against.
 *
 * All the rules live in lib/flows.mjs; this script owns only the round-trips.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixtureFileName, toFixture } from './lib/flows.mjs'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const GRAPHQL_API = 'https://api.amplience.net/graphql'
const AMPLIENCE_API = 'https://api.amplience.net/v2/content'
const AMPLIENCE_AUTH = 'https://auth.amplience.net/oauth/token'

// ── Arguments ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const optionAfter = (name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}
const filePath = optionAfter('--file')
const outDir = optionAfter('--out') ?? path.join(packageRoot, 'flows')
const flowId = argv.find((arg) => !arg.startsWith('--') && arg !== filePath && arg !== outDir)

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function required(name, why) {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    fail(
      `${name} is not set — it is needed to ${why}. Activate a hub in the Environment Manager, or set it in packages/hub-management/.env.`,
    )
  }
  return value.trim()
}

function personalAccessToken() {
  for (const name of ['AMPLIENCE_PAT', 'FLOWS_CLI_TOKEN']) {
    const value = process.env[name]
    if (value !== undefined && value.trim() !== '') return value.trim()
  }
  return fail(
    'No personal access token. Flow management does not accept the hub credentials — set one up ' +
      'under the Workforce row of the credentials check in the Environment Manager, or export ' +
      'AMPLIENCE_PAT.',
  )
}

// ── Transports ────────────────────────────────────────────────────────────────

async function graphql(token, query, variables) {
  const res = await fetch(GRAPHQL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json().catch(() => null)
  // A rejected query comes back as HTTP 400 *with* the reason, so errors are
  // read before the status code.
  const message = body?.errors?.[0]?.message
  if (message !== undefined) fail(`Workforce API: ${message}`)
  if (!res.ok) fail(`Workforce API: HTTP ${res.status}`)
  return body?.data
}

async function managementToken() {
  const res = await fetch(AMPLIENCE_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: required('AMPLIENCE_CLIENT_ID', 'read the hub over the Management API'),
      client_secret: required('AMPLIENCE_CLIENT_SECRET', 'read the hub over the Management API'),
    }),
  })
  if (!res.ok) fail(`Amplience auth failed: HTTP ${res.status}`)
  return (await res.json()).access_token
}

async function managementGet(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) fail(`Management API ${res.status}: ${url}`)
  return res.json()
}

// ── Reads ─────────────────────────────────────────────────────────────────────

const FLOW_QUERY = `query flow($flowId: ID!) {
  contentFlow(id: $flowId) { id label description status flow }
}`

const REGISTRY_QUERY = `query registry($hubId: ID!) {
  cmsHub(id: $hubId) {
    extensionInstances { id label extension { id } }
    webhookListeners { edges { node { id label } } }
  }
}`

/** The opaque id Workforce addresses a hub by: base64 of `CMSHub:<org>/<hub>`. */
const cmsHubId = (organizationId, hubId) =>
  Buffer.from(`CMSHub:${organizationId}/${hubId}`, 'utf8').toString('base64')

async function readRegistry(token, mgmtToken, hubId, organizationId) {
  const data = await graphql(token, REGISTRY_QUERY, { hubId: cmsHubId(organizationId, hubId) })
  const hub = data?.cmsHub ?? {}

  // Workflow states are a Dynamic Content concept, so they come from the
  // Management API rather than from Workforce. The embedded key has been seen
  // spelled both ways, so take whichever is there rather than guessing.
  const body = await managementGet(
    mgmtToken,
    `${AMPLIENCE_API}/hubs/${hubId}/workflow-states?size=100`,
  )
  const embedded = body?._embedded ?? {}
  const states = embedded['workflow-states'] ?? embedded.workflowStates ?? []

  return {
    extensionInstances: (hub.extensionInstances ?? [])
      .filter((i) => typeof i?.id === 'string' && typeof i.extension?.id === 'string')
      .map((i) => ({
        id: i.id,
        extensionId: i.extension.id,
        ...(typeof i.label === 'string' ? { label: i.label } : {}),
      })),
    listeners: (hub.webhookListeners?.edges ?? [])
      .map((edge) => edge?.node)
      .filter((node) => typeof node?.id === 'string' && typeof node.label === 'string')
      .map((node) => ({ id: node.id, label: node.label })),
    workflowStates: states
      .filter((s) => typeof s?.id === 'string' && typeof s.label === 'string')
      .map((s) => ({ id: s.id, label: s.label })),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (filePath === undefined && flowId === undefined) {
  fail('Give a flow id to pull, or --file <path> to tokenise an exported one.')
}

const token = personalAccessToken()
const hubId = required('AMPLIENCE_HUB_ID', 'identify the hub to read')
const mgmtToken = await managementToken()

const organizationId =
  process.env.AMPLIENCE_ORGANIZATION_ID?.trim() ||
  (await managementGet(mgmtToken, `${AMPLIENCE_API}/hubs/${hubId}`)).organizationId

if (typeof organizationId !== 'string' || organizationId === '') {
  fail(`Hub ${hubId} reported no organizationId, so the Workforce hub id cannot be built.`)
}

let exported
if (filePath !== undefined) {
  if (!existsSync(filePath)) fail(`No such file: ${filePath}`)
  exported = JSON.parse(readFileSync(filePath, 'utf8'))
  if (exported.sourceHubId !== undefined && exported.sourceHubId !== hubId) {
    console.warn(
      `\n⚠ This export came from hub ${exported.sourceHubId} but the active hub is ${hubId}. ` +
        `Its references are being matched against the active hub's registry, so expect anything ` +
        `that only exists on the source hub to be left as-is.`,
    )
  }
} else {
  const data = await graphql(token, FLOW_QUERY, { flowId })
  if (data?.contentFlow == null)
    fail(`No flow ${flowId} — check the id and that the token reaches this hub.`)
  exported = { ...data.contentFlow, sourceHubId: hubId }
}

const registry = await readRegistry(token, mgmtToken, hubId, organizationId)
const { fixture, warnings, leftover } = toFixture(exported, registry)

mkdirSync(outDir, { recursive: true })
const target = path.join(outDir, fixtureFileName(fixture.label))
writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')

console.log(`\n✓ ${fixture.label}`)
console.log(`  → ${path.relative(process.cwd(), target)}`)
console.log(
  `  ${fixture.flow.actions?.length ?? 0} actions, ${fixture.flow.edges?.length ?? 0} edges, ` +
    `${fixture.flow.virtualActions?.length ?? 0} action types declared`,
)

for (const warning of warnings) console.warn(`\n⚠ ${warning}`)

if (leftover.length > 0) {
  console.log(
    `\n  Left as-is, because no rule covers them — check each is the same on every hub you push to:`,
  )
  for (const reference of leftover) console.log(`    · ${reference}`)
}
console.log()
