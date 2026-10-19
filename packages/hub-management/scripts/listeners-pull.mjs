#!/usr/bin/env node
/**
 * listeners:pull — write the active hub's webhook listeners out as fixtures
 * (ADR-0023).
 *
 * Usage:
 *   pnpm listeners:pull              every listener on the hub
 *   pnpm listeners:pull "<label>"    just one, matched on its exact label
 *   [--shared]                       write to webhook-listeners/ (checked in)
 *                                    instead of its local/ (the default)
 *   [--out <dir>]                    somewhere else entirely
 *
 * This is the authoring path, and it exists because the alternative is guessing.
 * A flow's `${listener:Label}` is written from the label the *source hub* uses,
 * so a fixture whose label was typed by hand resolves against nothing — it
 * quietly seeds a listener no flow references, and the flow still refuses.
 *
 * All the rules live in lib/listeners.mjs; this script owns only the
 * round-trips.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { pullTarget } from './lib/fixtures.mjs'
import { listenerFileName, toListenerFixture } from './lib/listeners.mjs'
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

const argv = process.argv.slice(2)
const optionAfter = (name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}
const outDir =
  optionAfter('--out') ??
  pullTarget(path.join(packageRoot, 'webhook-listeners'), { shared: argv.includes('--shared') })
const only = argv.find((arg) => !arg.startsWith('--') && arg !== outDir)

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

const report = (error) => fail(error instanceof Error ? error.message : String(error))
process.on('unhandledRejection', report)
process.on('uncaughtException', report)

/** The schema and security live on the single-listener query, not the list. */
const READ_QUERY = `query listener($id: ID!) {
  webhookListener(id: $id) { id label schema security { __typename } }
}`

const token = personalAccessToken()
const hubId = requiredEnv('AMPLIENCE_HUB_ID', 'identify the hub to read')
const hubName = process.env.AMPLIENCE_HUB_NAME?.trim()
const mgmtToken = await managementToken()
const hubRef = cmsHubId(await organizationOf(mgmtToken, hubId), hubId)

const listed = await readListeners(token, hubRef)
const wanted = only === undefined ? listed : listed.filter((listener) => listener.label === only)

if (listed.length === 0) fail(`No webhook listeners on hub ${hubName ?? hubId}.`)
if (wanted.length === 0) {
  fail(`No listener labelled "${only}". On this hub: ${listed.map((l) => l.label).join(', ')}`)
}

mkdirSync(outDir, { recursive: true })

console.log(`\n→ Listeners on hub ${hubName ?? hubId}`)
const warnings = []
for (const node of wanted) {
  const full = (await graphql(token, READ_QUERY, { id: node.id }))?.webhookListener
  const { fixture, warnings: reasons } = toListenerFixture(
    { ...node, ...(full ?? {}) },
    { sourceHubId: hubId },
  )
  const target = path.join(outDir, listenerFileName(fixture.label))
  writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
  console.log(`  ✓ ${fixture.label}\n      → ${path.relative(process.cwd(), target)}`)
  warnings.push(...reasons)
}

for (const warning of warnings) console.warn(`\n⚠ ${warning}`)

console.log(
  `\n  ${wanted.length} fixture(s) written. Check the labels match what your flow fixtures ` +
    `reference — the label is the only handle a \${listener:…} token has.\n`,
)
