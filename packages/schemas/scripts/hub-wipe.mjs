#!/usr/bin/env node
/**
 * INTERIM (QL-92) — dc-cli hub wipe companion to hub-import.mjs.
 *
 * Resets a hub to a clean state so it can be re-seeded from scratch:
 *
 *   1. Deletes the shared dc-cli mapping file for this hub
 *      (~/.amplience/imports/quadratic-<hubName>.json).
 *      Without the mapping the next hub:import creates new items rather
 *      than updating existing ones, which is what "start fresh" means.
 *
 *   2. Frees delivery keys held by *already-archived* items. Delivery keys
 *      are unique hub-wide and archived items keep theirs reserved, so an
 *      item archived without its keys being stripped (the DC UI archives
 *      this way, as did older dc-cli versions that predate multi-value
 *      `deliveryKeys`) leaves the next seed hitting 409
 *      CONTENT_ITEM_DELIVERY_KEYS_DUPLICATE — the map is gone, dc-cli
 *      creates fresh items, and the old archived item still owns the key.
 *      dc-cli itself can't reach these: `content-item archive` (and the
 *      `hub clean` content step, which is the same handler) only
 *      enumerates ACTIVE items. Each offender is unarchived, stripped,
 *      and re-archived via dc-cli's own management SDK. Read-only when
 *      there are no offenders. Needs AMPLIENCE_CLIENT_ID /
 *      AMPLIENCE_CLIENT_SECRET — when only a dc-cli active configuration
 *      is available it is skipped with a warning.
 *
 *   3. Archives every content item in the content and slots repositories
 *      so previously-published items stop being served by Delivery.
 *      dc-cli strips delivery keys (legacy and multi-value) from each
 *      item before archiving it, so active items need no separate pass.
 *
 *   4. Archives every content type in the hub.
 *
 *   5. Archives every content type schema in the hub so the next
 *      hub:import:schemas registers them fresh.
 *
 * Configuration is read from environment variables (same set as
 * hub-import.mjs). Run via the environment-manager GUI which injects
 * the selected environment's credentials directly, or manually:
 *
 *   AMPLIENCE_HUB_NAME=myhub \
 *   AMPLIENCE_HUB_ID=abc123 \
 *   AMPLIENCE_REPO_CONTENT=abc123 \
 *   AMPLIENCE_REPO_SLOTS=def456 \
 *   node packages/schemas/scripts/hub-wipe.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DynamicContent } from 'dc-management-sdk-js'

const env = (name) => {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

const require_ = (name, why) => {
  const value = env(name)
  if (value === undefined) {
    console.error(`${name} is not set — needed to ${why}.`)
    process.exit(1)
  }
  return value
}

/** dc-cli credential flags — only when the env provides a full set. */
const credentialFlags = () => {
  const clientId = env('AMPLIENCE_CLIENT_ID')
  const clientSecret = env('AMPLIENCE_CLIENT_SECRET')
  const hubId = env('AMPLIENCE_HUB_ID')
  if (clientId && clientSecret && hubId) {
    return ['--clientId', clientId, '--clientSecret', clientSecret, '--hubId', hubId]
  }
  return []
}

const dcCli = (...args) =>
  new Promise((resolve, reject) => {
    // Credentials are appended after this log line — secrets never echo.
    console.log(`\n→ dc-cli ${args.join(' ')}`)
    const child = spawn('dc-cli', [...args, ...credentialFlags()], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    })
    const watch = (stream, sink) => {
      stream.on('data', (chunk) => sink.write(chunk.toString()))
    }
    watch(child.stdout, process.stdout)
    watch(child.stderr, process.stderr)
    child.on('error', () => {
      console.error(
        'Could not run dc-cli. Run this script via pnpm so node_modules/.bin is on the PATH.',
      )
      process.exit(1)
    })
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`dc-cli exited with code ${code ?? 'unknown'}`))
      else resolve()
    })
  })

// ── Stranded delivery-key freeing ─────────────────────────────────────────────

/** Whether an item body still holds any delivery key (legacy or multi-value). */
const hasDeliveryKeys = (body) =>
  Boolean(body?._meta?.deliveryKey) || (body?._meta?.deliveryKeys?.values?.length ?? 0) > 0

/**
 * Free delivery keys held by *archived* items: unarchive, strip (the same
 * body mutation dc-cli's archive applies to active items), re-archive.
 * Read-only unless an offender is found, and idempotent — a re-run finds
 * nothing left to strip. Uses dc-cli's own management SDK.
 */
const freeArchivedDeliveryKeys = async (client, repoId, repoLabel) => {
  const repo = await client.contentRepositories.get(repoId)

  // Collect the full list before mutating — re-archiving while paginating
  // would shift the pages underneath the walk.
  const archived = []
  for (let page = 0; ; page++) {
    const result = await repo.related.contentItems.list({ status: 'ARCHIVED', size: 100, page })
    archived.push(...result.getItems())
    if (page >= (result.page?.totalPages ?? 1) - 1) break
  }

  let freed = 0
  for (const item of archived) {
    // Belt and braces: trust the item's own status over the list filter.
    if (item.status !== 'ARCHIVED' || !hasDeliveryKeys(item.body)) continue
    const unarchived = await item.related.unarchive()
    unarchived.body._meta.deliveryKey = null
    unarchived.body._meta.deliveryKeys = null
    const updated = await unarchived.related.update(unarchived)
    await updated.related.archive()
    freed += 1
  }
  console.log(`✓ Freed delivery keys on ${freed} archived item(s) in ${repoLabel} repo`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

const hubName = require_('AMPLIENCE_HUB_NAME', 'identify the hub mapping file')
const contentRepo = require_('AMPLIENCE_REPO_CONTENT', 'target the content repository')
const slotsRepo = require_('AMPLIENCE_REPO_SLOTS', 'target the slots repository')
require_('AMPLIENCE_HUB_ID', 'archive content type schemas (--hubId is required by dc-cli)')

// 1. Delete mapping file
const mapFile = path.join(os.homedir(), '.amplience', 'imports', `quadratic-${hubName}.json`)
if (existsSync(mapFile)) {
  rmSync(mapFile)
  console.log(`✓ Deleted mapping file: ${mapFile}`)
} else {
  console.log(`  Mapping file not present (already clean): ${mapFile}`)
}

// 2. Free delivery keys stranded on archived items (see module doc).
const clientId = env('AMPLIENCE_CLIENT_ID')
const clientSecret = env('AMPLIENCE_CLIENT_SECRET')
if (clientId !== undefined && clientSecret !== undefined) {
  console.log('\nChecking archived items for stranded delivery keys…')
  const client = new DynamicContent({ client_id: clientId, client_secret: clientSecret })
  await freeArchivedDeliveryKeys(client, contentRepo, 'content')
  await freeArchivedDeliveryKeys(client, slotsRepo, 'slots')
} else {
  console.warn(
    '\n⚠ AMPLIENCE_CLIENT_ID/SECRET not set — cannot check archived items for ' +
      'stranded delivery keys. If a previous archive kept keys (DC UI, older ' +
      'dc-cli), the next seed may fail with CONTENT_ITEM_DELIVERY_KEYS_DUPLICATE.',
  )
}

// 3. Archive all content items in both repos.
// Omitting the id positional archives all items in scope (dc-cli behaviour).
// --repoId scopes to the target repo; -f skips the confirmation prompt.
console.log(`\nArchiving all content in content repo (${contentRepo})…`)
await dcCli('content-item', 'archive', '--repoId', contentRepo, '-f')

console.log(`\nArchiving all content in slots repo (${slotsRepo})…`)
await dcCli('content-item', 'archive', '--repoId', slotsRepo, '-f')

// 4. Archive all content types in the hub.
// Omitting the id positional archives all types; --hubId is required and
// is injected via credentialFlags() when AMPLIENCE_HUB_ID is set.
console.log('\nArchiving all content types…')
await dcCli('content-type', 'archive', '-f')

// 5. Archive all content type schemas in the hub.
console.log('\nArchiving all content type schemas…')
await dcCli('content-type-schema', 'archive', '-f')

console.log('\n✓ Hub wipe complete — run Seed to repopulate from fixtures.')
