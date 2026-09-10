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
 *   2. Retracts every item still live in Delivery, and frees delivery keys
 *      held by *already-archived* items. Both are management-SDK passes over
 *      the active and archived populations of each repository; see below.
 *
 *   3. Archives every content item in the content and slots repositories.
 *      dc-cli strips delivery keys (legacy and multi-value) from each
 *      item before archiving it, so active items need no separate key pass.
 *
 *   4. Archives every content type in the hub.
 *
 *   5. Archives every content type schema in the hub so the next
 *      hub:import:schemas registers them fresh.
 *
 * Step 2 covers two failures that both come from archive being a
 * management-side lifecycle change rather than a Delivery operation:
 *
 *   Published snapshots survive archive. Archiving does not retract anything
 *   from `<hub>.cdn.content.amplience.net`; only `unpublish` does. A wipe that
 *   only archived therefore left every previous generation of seeded content
 *   live, and schema-wide reads (the Filter API, so `listBySchema`) kept
 *   returning all of them — a blog archive of three articles rendered 27 cards
 *   after nine wipe/seed cycles, each generation still answering under the
 *   delivery key it held when it was published. Local development hid it: the
 *   staging VSE serves current repository state, so only production
 *   accumulated. Items are unpublished before being archived, and archived
 *   items found still live are unarchived, unpublished and re-archived.
 *
 *   Delivery keys stay reserved on archived items. Keys are unique hub-wide,
 *   so an item archived without its keys being stripped (the DC UI archives
 *   this way, as did older dc-cli versions that predate multi-value
 *   `deliveryKeys`) leaves the next seed hitting 409
 *   CONTENT_ITEM_DELIVERY_KEYS_DUPLICATE — the map is gone, dc-cli creates
 *   fresh items, and the old archived item still owns the key. dc-cli itself
 *   can't reach these: `content-item archive` (and the `hub clean` content
 *   step, which is the same handler) only enumerates ACTIVE items.
 *
 * Both passes are read-only when there is nothing to do, and need
 * AMPLIENCE_CLIENT_ID / AMPLIENCE_CLIENT_SECRET — when only a dc-cli active
 * configuration is available they are skipped with a warning.
 *
 * Webhooks created by the seed (labelled `Quadratic — …`) are removed first on
 * a full wipe, and on the standalone `webhooks` scope. First, so the teardown
 * below can't fire the integrations it is in the middle of removing. Unlike extensions and
 * workflow states, a stale webhook isn't inert: it keeps firing on every
 * publish and failing against a deployment that no longer exists, which shows
 * up in the hub's webhook log as a permanently broken integration. Only the
 * managed label prefix is touched — a hand-made or third-party webhook on a
 * shared hub survives.
 *
 * Extensions and workflow states are deliberately left in place. Both are
 * hub-wide configuration that a hub may share with things other than
 * Amplience Frontend Starter, so a content wipe is the wrong place to destroy them — and it
 * isn't necessary: re-seeding updates each extension in place by name, and
 * updates each workflow state through the settings mapping file (kept at
 * quadratic-settings-<hub>.json, separate from the content map this script
 * deletes, precisely so the source→target status ids survive a wipe and the
 * extensions that reference them keep resolving after a re-seed).
 *
 * Configuration is read from environment variables (same set as
 * hub-import.mjs). Run via the environment-manager GUI which injects
 * the selected environment's credentials directly, or manually:
 *
 *   AMPLIENCE_HUB_NAME=myhub \
 *   AMPLIENCE_HUB_ID=abc123 \
 *   AMPLIENCE_REPO_CONTENT=abc123 \
 *   AMPLIENCE_REPO_SLOTS=def456 \
 *   node packages/hub-management/scripts/hub-wipe.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DynamicContent } from 'dc-management-sdk-js'

import { canUnpublish, isEnvironmentalFailure, mayBePublished } from './lib/publishing.mjs'
import { MANAGED_LABEL_PREFIX } from './lib/webhooks.mjs'

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

// ── Delivery retraction and stranded delivery-key freeing ────────────────────

/** Whether an item body still holds any delivery key (legacy or multi-value). */
const hasDeliveryKeys = (body) =>
  Boolean(body?._meta?.deliveryKey) || (body?._meta?.deliveryKeys?.values?.length ?? 0) > 0

/** List every item in a repository at the given lifecycle status. */
const listAll = async (repo, status) => {
  // Collect the full list before mutating — archiving or unpublishing while
  // paginating would shift the pages underneath the walk.
  const items = []
  for (let page = 0; ; page++) {
    const result = await repo.related.contentItems.list({ status, size: 100, page })
    items.push(...result.getItems())
    if (page >= (result.page?.totalPages ?? 1) - 1) break
  }
  return items
}

/**
 * Tracks whether unpublishing is possible at all in this run.
 *
 * The first environmental failure (credentials without the permission, or a
 * hub without unpublish enabled) will repeat for every remaining item, so it
 * disables further attempts and is reported once, with the consequence spelled
 * out — a wipe that cannot unpublish leaves the old generation live, which is
 * the bug this pass exists to prevent, and the operator needs to know.
 */
const unpublishing = { enabled: true, blockedBy: undefined }

/**
 * Retract one item from Delivery. Returns true when a snapshot was withdrawn.
 *
 * A per-item failure (an edition assignment, a transient 5xx, a rate limit) is
 * warned about and swallowed: the teardown must not abort half-done, matching
 * the `--ignoreError` posture of the dc-cli passes below.
 */
const unpublishItem = async (item) => {
  if (!unpublishing.enabled) return false
  if (!mayBePublished(item) || !canUnpublish(item)) return false
  try {
    await item.related.unpublish()
    return true
  } catch (error) {
    if (isEnvironmentalFailure(error)) {
      unpublishing.enabled = false
      unpublishing.blockedBy = error
      return false
    }
    console.warn(`  ⚠ Could not unpublish "${item.label ?? item.id}": ${error}`)
    return false
  }
}

/**
 * Unpublish every active item in a repository, before dc-cli archives them.
 * Once archived the API no longer offers the action, so the order matters.
 */
const unpublishActiveItems = async (client, repoId, repoLabel) => {
  const repo = await client.contentRepositories.get(repoId)
  let unpublished = 0
  for (const item of await listAll(repo, 'ACTIVE')) {
    if (await unpublishItem(item)) unpublished += 1
  }
  console.log(`✓ Unpublished ${unpublished} active item(s) in ${repoLabel} repo`)
}

/**
 * Reclaim *archived* items: unarchive, retract any live snapshot, strip
 * delivery keys (the same body mutation dc-cli's archive applies to active
 * items), re-archive.
 *
 * The unarchive is what makes both fixes reachable — an archived item offers
 * neither `unpublish` nor an update — so it happens whenever either job might
 * apply. Read-only unless an offender is found. Idempotent as long as the API
 * reports `publishingStatus`; where it doesn't, `mayBePublished` stays
 * pessimistic and each run re-checks (the HAL gate keeps that to one list call
 * per item, not one POST).
 */
const reclaimArchivedItems = async (client, repoId, repoLabel, ignoreSchemaValidation) => {
  const repo = await client.contentRepositories.get(repoId)
  const archived = await listAll(repo, 'ARCHIVED')

  let freed = 0
  let unpublished = 0
  for (const item of archived) {
    // Belt and braces: trust the item's own status over the list filter.
    if (item.status !== 'ARCHIVED') continue
    const needsKeyStrip = hasDeliveryKeys(item.body)
    const mightBeLive = unpublishing.enabled && mayBePublished(item)
    if (!needsKeyStrip && !mightBeLive) continue

    let current = await item.related.unarchive()

    if (needsKeyStrip) {
      current.body._meta.deliveryKey = null
      current.body._meta.deliveryKeys = null
      // ignoreSchemaValidation lets us strip keys from items whose body no
      // longer conforms to a since-drifted schema. It requires the hub's
      // "Ignore schema validation" setting to be ON (org/hub admin, DC
      // Properties) — otherwise the API rejects the param with
      // IGNORE_SCHEMA_VALIDATION_NOT_ENABLED, so it's opt-in via env.
      const updateParams = ignoreSchemaValidation ? { ignoreSchemaValidation: true } : {}
      current = await current.related.update(current, updateParams)
      freed += 1
    }

    // Unpublish last of the two, on whichever resource is freshest: the update
    // above is the version-checked call, so it goes first and hands back the
    // version the archive below needs. Stripping the key doesn't affect the
    // retraction — unpublish addresses the item, and the published snapshot
    // still holds the key it was published with until it's withdrawn.
    if (mightBeLive && (await unpublishItem(current))) unpublished += 1

    await current.related.archive()
  }
  console.log(
    `✓ Reclaimed archived items in ${repoLabel} repo — ` +
      `unpublished ${unpublished}, freed delivery keys on ${freed}`,
  )
}

/** Run both management-SDK passes over one repository. */
const reclaimRepo = async (client, repoId, repoLabel, ignoreSchemaValidation) => {
  await unpublishActiveItems(client, repoId, repoLabel)
  await reclaimArchivedItems(client, repoId, repoLabel, ignoreSchemaValidation)
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Scope: `items` wipes only content items (map + delivery keys + items);
// `webhooks` removes only the seeded webhooks; `all` (default) does both and
// also archives content types and content type schemas. Mirrors
// hub-import.mjs's step argument so the two scripts pair up.
const scopes = ['items', 'webhooks', 'all']
const scope = process.argv[2] ?? 'all'
if (!scopes.includes(scope)) {
  console.error(`Unknown scope "${scope}" — expected one of: ${scopes.join(', ')}`)
  process.exit(1)
}
console.log(`\n▶ hub-wipe scope: ${scope}`)

// A webhooks-only wipe touches no repository, so it doesn't ask for repo ids.
const wipesContent = scope !== 'webhooks'

const hubName = require_('AMPLIENCE_HUB_NAME', 'identify the hub mapping file')
const contentRepo = wipesContent
  ? require_('AMPLIENCE_REPO_CONTENT', 'target the content repository')
  : undefined
const slotsRepo = wipesContent
  ? require_('AMPLIENCE_REPO_SLOTS', 'target the slots repository')
  : undefined
// Optional — only wiped when the deployment uses CMS-managed site config.
const siteComponentsRepo = env('AMPLIENCE_REPO_SITE_COMPONENTS')
require_(
  'AMPLIENCE_HUB_ID',
  wipesContent
    ? 'archive content type schemas (--hubId is required by dc-cli)'
    : 'identify the hub whose webhooks are being removed',
)

/**
 * Delete every webhook the seed owns, leaving anything else alone.
 *
 * Identity is the label prefix, the same handle hub-import matches on, so a
 * wipe and a re-seed agree on what "ours" means without a mapping file.
 */
const wipeWebhooks = async () => {
  const clientId = env('AMPLIENCE_CLIENT_ID')
  const clientSecret = env('AMPLIENCE_CLIENT_SECRET')
  if (clientId === undefined || clientSecret === undefined) {
    console.warn(
      '\n⚠ Skipping webhooks — AMPLIENCE_CLIENT_ID / AMPLIENCE_CLIENT_SECRET are not set. ' +
        'Any seeded webhook is still live and will keep firing; remove it in the DC UI ' +
        'or re-run with credentials.',
    )
    return
  }
  const client = new DynamicContent({ client_id: clientId, client_secret: clientSecret })
  const hub = await client.hubs.get(env('AMPLIENCE_HUB_ID'))
  const all = []
  for (let page = 0; ; page++) {
    const result = await hub.related.webhooks.list({ size: 100, page })
    all.push(...result.getItems())
    if (page >= (result.page?.totalPages ?? 1) - 1) break
  }
  const managed = all.filter(
    (w) => typeof w.label === 'string' && w.label.startsWith(MANAGED_LABEL_PREFIX),
  )
  if (managed.length === 0) {
    console.log(`\n  No "${MANAGED_LABEL_PREFIX}…" webhooks on the hub (already clean).`)
    return
  }
  console.log(`\nRemoving ${managed.length} seeded webhook(s)…`)
  for (const webhook of managed) {
    try {
      await webhook.related.delete()
      console.log(`  - ${webhook.label}`)
    } catch (err) {
      // One undeletable webhook must not abort the teardown, same principle as
      // --ignoreError on the archive passes.
      console.warn(
        `  ⚠ Could not delete "${webhook.label}": ` +
          `${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  const left = all.length - managed.length
  if (left > 0) console.log(`  ${left} unmanaged webhook(s) left untouched.`)
}

// Webhooks go first on a full wipe: removing them before the content churn
// means the teardown can't trigger the very integrations it is dismantling,
// and it matches the resource order the Environment Manager lists.
if (scope !== 'items') await wipeWebhooks()
if (scope === 'webhooks') {
  console.log('\n✓ Webhook wipe complete.')
  process.exit(0)
}

// Whether to pass --ignoreSchemaValidation. dc-cli archives by NULLing
// delivery keys via a schema-validated update, so an item authored under a
// since-drifted schema (e.g. `Site — logo`) fails with CONTENT_TYPE_INVALID
// and aborts the batch. The flag bypasses body validation, but the API only
// accepts it when the hub's "Ignore schema validation" setting is ON
// (org/hub admin, DC → hub → Properties). Opt in per environment once that
// setting is enabled; leave it off and the wipe still completes thanks to
// --ignoreError below, just skipping any items it can't strip.
const ignoreSchemaValidation = ['1', 'true', 'yes'].includes(
  (env('AMPLIENCE_IGNORE_SCHEMA_VALIDATION') ?? '').toLowerCase(),
)

// 1. Delete mapping file
// Filename keeps the `quadratic-` prefix: renaming it orphans every existing hub's map, so dc-cli would re-import the whole model as duplicates.
const mapFile = path.join(os.homedir(), '.amplience', 'imports', `quadratic-${hubName}.json`)
if (existsSync(mapFile)) {
  rmSync(mapFile)
  console.log(`✓ Deleted mapping file: ${mapFile}`)
} else {
  console.log(`  Mapping file not present (already clean): ${mapFile}`)
}

// 2. Retract live snapshots from Delivery and free stranded delivery keys
// (see module doc). Both run before the dc-cli archive passes below, because
// archived items offer neither action.
const clientId = env('AMPLIENCE_CLIENT_ID')
const clientSecret = env('AMPLIENCE_CLIENT_SECRET')
if (clientId !== undefined && clientSecret !== undefined) {
  console.log('\nRetracting published content and checking for stranded delivery keys…')
  const client = new DynamicContent({ client_id: clientId, client_secret: clientSecret })
  await reclaimRepo(client, contentRepo, 'content', ignoreSchemaValidation)
  await reclaimRepo(client, slotsRepo, 'slots', ignoreSchemaValidation)
  if (siteComponentsRepo !== undefined) {
    await reclaimRepo(client, siteComponentsRepo, 'site-components', ignoreSchemaValidation)
  }
  if (!unpublishing.enabled) {
    console.warn(
      `\n⚠ Unpublishing stopped after: ${unpublishing.blockedBy}\n` +
        '  Either the credentials lack the permission or the hub does not have\n' +
        '  unpublish enabled (ask Amplience support). Archiving alone does NOT\n' +
        '  remove content from Delivery, so the seeded generation this wipe is\n' +
        '  tearing down will stay live on the CDN and the next seed will add\n' +
        '  another alongside it — schema-wide reads will return both.',
    )
  }
} else {
  console.warn(
    '\n⚠ AMPLIENCE_CLIENT_ID/SECRET not set — cannot retract published content ' +
      'or check archived items for stranded delivery keys. Archived-but-published ' +
      'items stay live in Delivery, and if a previous archive kept keys (DC UI, ' +
      'older dc-cli) the next seed may fail with CONTENT_ITEM_DELIVERY_KEYS_DUPLICATE.',
  )
}

// 3. Archive all content items in both repos.
// Omitting the id positional archives all items in scope (dc-cli behaviour).
// --repoId scopes to the target repo; -f skips the confirmation prompt.
// --ignoreError: one item that can't be archived (e.g. a drifted body whose
// key-strip update fails) must not abort the whole teardown. --ignoreSchemaValidation
// (opt-in, see above) additionally lets those drifted items be stripped and
// archived cleanly rather than skipped.
const archiveFlags = [
  '-f',
  '--ignoreError',
  ...(ignoreSchemaValidation ? ['--ignoreSchemaValidation'] : []),
]

console.log(`\nArchiving all content in content repo (${contentRepo})…`)
await dcCli('content-item', 'archive', '--repoId', contentRepo, ...archiveFlags)

console.log(`\nArchiving all content in slots repo (${slotsRepo})…`)
await dcCli('content-item', 'archive', '--repoId', slotsRepo, ...archiveFlags)

if (siteComponentsRepo !== undefined) {
  console.log(`\nArchiving all content in Site Components repo (${siteComponentsRepo})…`)
  await dcCli('content-item', 'archive', '--repoId', siteComponentsRepo, ...archiveFlags)
}

if (scope === 'all') {
  // 4. Archive all content types in the hub.
  // Omitting the id positional archives all types; --hubId is required and
  // is injected via credentialFlags() when AMPLIENCE_HUB_ID is set.
  console.log('\nArchiving all content types…')
  await dcCli('content-type', 'archive', '-f')

  // 5. Archive all content type schemas in the hub.
  console.log('\nArchiving all content type schemas…')
  await dcCli('content-type-schema', 'archive', '-f')
} else {
  console.log('\n(scope=items) Leaving content types and schemas in place.')
}

console.log('\n✓ Hub wipe complete — run Seed to repopulate from fixtures.')
