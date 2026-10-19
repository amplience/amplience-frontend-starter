#!/usr/bin/env node
/**
 * flows:pull — turn a Workforce flow into a checked-in fixture (ADR-0023).
 *
 * Usage:
 *   pnpm flows:pull <flowId>        pull from the active hub
 *   pnpm flows:pull --file <path>   tokenise a browser-extension export instead
 *   [--shared]                      write to flows/ (checked in) instead of
 *                                   flows/local/ (gitignored, the default)
 *   [--out <dir>]                   somewhere else entirely
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

import { pullTarget } from './lib/fixtures.mjs'
import { fixtureFileName, toFixture } from './lib/flows.mjs'
import {
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
const filePath = optionAfter('--file')
// Lands in flows/local/ (gitignored) unless --shared. A flow pulled from a
// customer hub can carry their brand names in instruction prose, so committing
// one is a deliberate act.
const outDir =
  optionAfter('--out') ??
  pullTarget(path.join(packageRoot, 'flows'), { shared: argv.includes('--shared') })
const flowId = argv.find((arg) => !arg.startsWith('--') && arg !== filePath && arg !== outDir)

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

// The shared round-trips throw rather than exiting, so a caller can decide how
// to report. Here that decision is: one line, no stack trace.
const report = (error) => fail(error instanceof Error ? error.message : String(error))
process.on('unhandledRejection', report)
process.on('uncaughtException', report)

// ── Reads ─────────────────────────────────────────────────────────────────────

const FLOW_QUERY = `query flow($flowId: ID!) {
  contentFlow(id: $flowId) {
    id label description status flow
    icon { ... on ContentFlowIconPreset { name color } }
  }
}`

// ── Main ──────────────────────────────────────────────────────────────────────

if (filePath === undefined && flowId === undefined) {
  fail('Give a flow id to pull, or --file <path> to tokenise an exported one.')
}

const token = personalAccessToken()
const hubId = requiredEnv('AMPLIENCE_HUB_ID', 'identify the hub to read')
const mgmtToken = await managementToken()

const organizationId = await organizationOf(mgmtToken, hubId)

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

const { registry, warnings: registryWarnings } = await readRegistry(
  token,
  mgmtToken,
  hubId,
  organizationId,
)
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

for (const warning of [...registryWarnings, ...warnings]) console.warn(`\n⚠ ${warning}`)

if (leftover.length > 0) {
  console.log(
    `\n  Left as-is, because no rule covers them — check each is the same on every hub you push to:`,
  )
  for (const reference of leftover) console.log(`    · ${reference}`)
}
console.log()
