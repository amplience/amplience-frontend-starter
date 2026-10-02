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
 *   6. Deletes every extension on the hub — all of them, not only the ones
 *      the seed created. Extensions are hub configuration like types and
 *      schemas, and re-seeding recreates them by name.
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
 * below can't fire the integrations it is in the middle of removing. Webhooks
 * are the one resource filtered by ownership, because a stale one isn't inert:
 * it keeps firing on every publish and failing against a deployment that no
 * longer exists, which shows up in the hub's webhook log as a permanently
 * broken integration. Only the managed label prefix is touched — a hand-made or
 * third-party webhook on a shared hub survives.
 *
 * Everything else is wiped wholesale, extensions included: the starter assumes
 * it owns the hub's model. A hub shared with other sites would lose their types,
 * schemas and extensions too — a use case too small to cater for yet, and the
 * place to add an ownership filter (like the webhooks one) if it ever isn't.
 *
 * Workflow states are left in place. Nothing removes them cleanly, and nothing
 * needs to: re-seeding updates each one through the settings mapping file (kept
 * at quadratic-settings-<hub>.json, separate from the content map this script
 * deletes, precisely so the source→target status ids survive a wipe and the
 * extensions that reference them resolve again after a re-seed).
 *
 * Usage:  node scripts/hub-wipe.mjs [all|content|types|schemas|extensions|webhooks]
 *                                   [--set <fixture set> | --orphaned | --custom]
 *                                   [--apply]
 *
 * The scope defaults to `all`, and runs the teardown in the reverse of the
 * seed order, each step refusing while a dependant still exists rather than
 * half-completing. `items` is accepted as a back-compat alias for `content`.
 *
 * The three selectors act on content items only, so they can't be combined
 * with another scope. `--set` runs unprompted, because the repository can put
 * that content back; `--orphaned` and `--custom` report what they would remove
 * and need `--apply`, because nothing can.
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
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DynamicContent } from 'dc-management-sdk-js'

import {
  availableSets,
  hasFlag,
  positional,
  readAllSets,
  readFlag,
  setFromArgv,
} from './lib/fixture-sets.mjs'
import { classifyHubItems, isRegenerable, selectForWipe, summarise } from './lib/provenance.mjs'
import { isEnvironmentalFailure, mayBePublished } from './lib/publishing.mjs'
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
const unpublishing = { enabled: true, blockedBy: undefined, done: 0, skipped: 0, failed: [] }

/**
 * Whether to send `ignoreSchemaValidation` on key-stripping updates, and
 * whether the hub has already told us it won't accept it.
 *
 * Set from the environment at startup. The hub is the authority, not the
 * config: an environment can claim the setting is on when it isn't, so the
 * first rejection turns it off for the rest of the run rather than failing
 * every remaining item the same way.
 */
const schemaOverride = { enabled: false, rejected: false }

/** Does this error carry a specific Amplience error code? */
const hasErrorCode = (error, code) =>
  (error?.response?.data?.errors ?? []).some((e) => e?.code === code)

/**
 * Retract one item from Delivery. Returns true when a snapshot was withdrawn.
 *
 * A per-item failure (an edition assignment, a transient 5xx, a rate limit) is
 * warned about and swallowed: the teardown must not abort half-done, matching
 * the `--ignoreError` posture of the dc-cli passes below.
 */
const unpublishItem = async (item) => {
  if (!unpublishing.enabled) {
    unpublishing.skipped += 1
    return false
  }
  if (!mayBePublished(item)) return false
  // Attempted even when the HAL link is absent. The link is missing from an
  // update response, which is what the caller holds after stripping delivery
  // keys — gating on it skipped every unpublish in a scoped wipe without a
  // word, leaving the content readable on CD2 (1 Oct 2026). A needless attempt
  // costs one rejection, which classifies itself below.
  try {
    await item.related.unpublish()
    unpublishing.done += 1
    return true
  } catch (error) {
    if (isEnvironmentalFailure(error)) {
      unpublishing.enabled = false
      unpublishing.blockedBy = error
      unpublishing.skipped += 1
      return false
    }
    unpublishing.failed.push(`${item.label ?? item.id}: ${messageOf(error)}`)
    return false
  }
}

/**
 * What the unpublish pass managed, said out loud.
 *
 * Silence was the actual bug: a run that unpublished nothing printed exactly
 * what a run that unpublished everything printed, so content left live on the
 * CDN looked like a clean wipe. Archive is a management-side lifecycle change
 * and only `unpublish` retracts the published copy, so this is the line that
 * says whether the content is really gone.
 */
const reportUnpublishing = () => {
  if (unpublishing.done > 0) console.log(`  ✓ Unpublished ${unpublishing.done} item(s)`)
  if (unpublishing.blockedBy !== undefined) {
    console.warn(
      `\n  ⚠ Unpublishing stopped after: ${messageOf(unpublishing.blockedBy)}\n` +
        `    ${unpublishing.skipped} item(s) were archived while still published, so Delivery\n` +
        '    will go on serving them — and the next seed adds a new copy alongside, so\n' +
        '    schema-wide reads (blog listings) return both. Either the API client lacks\n' +
        "    the permission or the hub doesn't have unpublish enabled (ask Amplience\n" +
        '    support); fix that, then re-run.',
    )
  }
  for (const line of unpublishing.failed) console.warn(`  ⚠ Could not unpublish ${line}`)
  if (unpublishing.failed.length > 0) {
    console.warn(
      `    Those ${unpublishing.failed.length} item(s) stay live on the CDN until they are\n` +
        '    unpublished — archiving alone does not retract them.',
    )
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

/** Best-effort message from an SDK error. */
const messageOf = (error) =>
  (error?.response?.data?.errors ?? [])
    .map((e) => e?.message)
    .filter(Boolean)
    .join('; ') || (error instanceof Error ? error.message : String(error))

/**
 * Save an item whose delivery keys have just been nulled.
 *
 * `ignoreSchemaValidation` is what lets a key be stripped from an item whose
 * body no longer conforms to a schema this hub registers — exactly the legacy
 * content a long-lived sandbox accumulates. The API only accepts the parameter
 * when the hub's "Ignore schema validation" setting is on (org/hub admin, DC →
 * hub → Properties), and an environment's config can claim that when it isn't
 * true. So the rejection is handled rather than trusted: say so once, stop
 * sending it, and retry. The retry may still fail validation, which is the
 * caller's problem to tolerate.
 */
const stripKeys = async (item) => {
  if (!schemaOverride.enabled) return item.related.update(item)
  try {
    return await item.related.update(item, { ignoreSchemaValidation: true })
  } catch (error) {
    if (!hasErrorCode(error, 'IGNORE_SCHEMA_VALIDATION_NOT_ENABLED')) throw error
    if (!schemaOverride.rejected) {
      schemaOverride.rejected = true
      console.warn(
        '\n  ⚠ This hub does not have "Ignore schema validation" enabled, though the\n' +
          '    environment asks for it. Continuing without it — items whose body no\n' +
          '    longer matches a registered schema will keep their delivery keys.\n' +
          '    Enable it in DC → hub → Properties, or clear\n' +
          '    AMPLIENCE_IGNORE_SCHEMA_VALIDATION to stop asking.\n',
      )
    }
    schemaOverride.enabled = false
    return item.related.update(item)
  }
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
const reclaimArchivedItems = async (client, repoId, repoLabel) => {
  const repo = await client.contentRepositories.get(repoId)
  const archived = await listAll(repo, 'ARCHIVED')

  let freed = 0
  let unpublished = 0
  const stranded = []
  const leftActive = []
  for (const item of archived) {
    // Belt and braces: trust the item's own status over the list filter.
    if (item.status !== 'ARCHIVED') continue
    const needsKeyStrip = hasDeliveryKeys(item.body)
    const mightBeLive = unpublishing.enabled && mayBePublished(item)
    if (!needsKeyStrip && !mightBeLive) continue

    // Inside its own guard: an item that won't unarchive is skipped, not fatal —
    // the same per-item stance as everything below. Nothing to put back, since
    // it never left the archive.
    let current
    try {
      current = await item.related.unarchive()
    } catch (error) {
      stranded.push(`${item.label ?? item.id}: could not unarchive — ${messageOf(error)}`)
      continue
    }

    try {
      // 🔴 Unpublish BEFORE stripping the key, never after. Removing a key from
      // a published item orphans it: the key→content entry is retracted by the
      // unpublish, matched on the key the item still holds, so an item stripped
      // first is unpublished under no key and the old one goes on serving the
      // last published snapshot indefinitely. Confirmed by Amplience support
      // (2 Oct 2026) as the documented order — unpublish, then change or remove
      // the key, then publish — and reproduced here before they confirmed it.
      // An orphaned key can only be reclaimed by putting it on another item,
      // publishing that, and unpublishing it again.
      if (mightBeLive && (await unpublishItem(current))) unpublished += 1

      if (needsKeyStrip) {
        current.body._meta.deliveryKey = null
        current.body._meta.deliveryKeys = null
        current = await stripKeys(current)
        freed += 1
      }
    } catch (error) {
      // One unreclaimable item must not abort the teardown — the same stance
      // unpublishItem takes, and what the dc-cli passes get from --ignoreError.
      // Legacy content authored under a schema this hub no longer registers is
      // the usual cause, and it is exactly what a sandbox accumulates.
      stranded.push(`${item.label ?? item.id}: ${messageOf(error)}`)
    } finally {
      // Always put it back: an item left unarchived is a worse outcome than
      // one that kept its delivery key.
      // It was unarchived above, so a failure here really does leave it active —
      // which needs saying, not swallowing.
      try {
        await current.related.archive()
      } catch (error) {
        leftActive.push(`${item.label ?? item.id}: ${messageOf(error)}`)
      }
    }
  }
  console.log(
    `✓ Reclaimed archived items in ${repoLabel} repo — ` +
      `unpublished ${unpublished}, freed delivery keys on ${freed}` +
      (stranded.length > 0 ? `, ${stranded.length} left alone` : '') +
      (leftActive.length > 0 ? `, ${leftActive.length} left ACTIVE` : ''),
  )
  for (const line of stranded) console.warn(`  ⚠ ${line}`)
  for (const line of leftActive) {
    console.warn(`  ⚠ Left ACTIVE — couldn't re-archive ${line}. Archive it in DC, or re-run.`)
  }
  return stranded.length + leftActive.length
}

/**
 * Run both management-SDK passes over one repository. The unpublish tally runs
 * across every repository, so the caller reports it once, after the last.
 */
const reclaimRepo = async (client, repoId, repoLabel) => {
  await unpublishActiveItems(client, repoId, repoLabel)
  await reclaimArchivedItems(client, repoId, repoLabel)
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Scope: `items` wipes only content items (map + delivery keys + items);
// `webhooks` removes only the seeded webhooks; `all` (default) does both and
// also archives content types and content type schemas. Mirrors
// hub-import.mjs's step argument so the two scripts pair up.
const scopes = ['all', 'content', 'types', 'schemas', 'extensions', 'webhooks']
// `items` is what this script called the content scope before the per-resource
// split; the runbooks and the Environment Manager still say it.
const ALIASES = { items: 'content' }
const requestedScope = positional(process.argv.slice(2)) ?? 'all'
const scope = ALIASES[requestedScope] ?? requestedScope
if (!scopes.includes(scope)) {
  console.error(`Unknown scope "${requestedScope}" — expected one of: ${scopes.join(', ')}`)
  process.exit(1)
}

// Provenance selectors. All three scope the wipe to content items only, so they
// never reach the type/schema passes below; at most one may be given.
//
// `--set` counts as given even when it's bare: read as absent, a forgotten name
// would turn `hub:wipe content --set` into a blanket content wipe and
// `hub:wipe --set` into a wipe of the whole hub.
const argv = process.argv.slice(2)
const setGiven = readFlag(argv, '--set').present
const selector = {
  set: undefined,
  custom: hasFlag(argv, '--custom'),
  orphaned: hasFlag(argv, '--orphaned'),
}
const chosen = [
  setGiven && '--set',
  selector.custom && '--custom',
  selector.orphaned && '--orphaned',
].filter(Boolean)
if (chosen.length > 1) {
  console.error(`${chosen.join(' and ')} select different things — pass one.`)
  process.exit(1)
}
const isScoped = chosen.length === 1
// A selector only has meaning over content items — types and schemas are shared
// by every set on the hub, so there is no per-set subset of them to remove.
// Naming another scope alongside one asks for two different things at once.
if (isScoped && requestedScope !== 'all' && scope !== 'content') {
  console.error(
    `${chosen[0]} selects content items, so it can't be combined with the "${requestedScope}" scope.\n` +
      `  Run \`hub:wipe content ${chosen[0]} …\`, or drop the flag to wipe ${requestedScope} outright.`,
  )
  process.exit(1)
}

// Only now, once the flags are known to make sense together, ask for a missing
// set name — at a terminal; anywhere else this throws with the sets to pick from.
// No default is offered: for a wipe, "the default set" is never a safe guess.
if (setGiven) {
  try {
    selector.set = await setFromArgv(argv, {
      question: 'Which fixture set do you want to wipe?',
      example: 'pnpm hub:wipe content --set <set>',
    })
  } catch (error) {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

const scopeLabel = selector.set === undefined ? chosen[0] : `--set ${selector.set}`
console.log(`\n▶ hub-wipe scope: ${isScoped ? `content (${scopeLabel})` : scope}`)

// Only the content scope touches repositories, so only it asks for repo ids.
const wipesContent = scope === 'content' || scope === 'all'

const hubName = require_('AMPLIENCE_HUB_NAME', 'identify the hub mapping file')
const contentRepo = wipesContent
  ? require_('AMPLIENCE_REPO_CONTENT', 'target the content repository')
  : undefined
const slotsRepo = wipesContent
  ? require_('AMPLIENCE_REPO_SLOTS', 'target the slots repository')
  : undefined
// Optional — only wiped when the deployment uses CMS-managed site config.
const siteComponentsRepo = env('AMPLIENCE_REPO_SITE_COMPONENTS')

// Filename keeps the `quadratic-` prefix: renaming it orphans every existing
// hub's map, so dc-cli would re-import the whole model as duplicates.
const mapFile = path.join(os.homedir(), '.amplience', 'imports', `quadratic-${hubName}.json`)
// A scoped wipe talks to the Management API directly and never reaches the
// dc-cli schema pass, so it has no use for a hub id.
if (!isScoped) {
  require_(
    'AMPLIENCE_HUB_ID',
    wipesContent
      ? 'archive content type schemas (--hubId is required by dc-cli)'
      : 'identify the hub whose webhooks are being removed',
  )
}

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
// Whether to pass --ignoreSchemaValidation. dc-cli archives by NULLing
// delivery keys via a schema-validated update, so an item authored under a
// since-drifted schema (e.g. `Site — logo`) fails with CONTENT_TYPE_INVALID
// and aborts the batch. The flag bypasses body validation, but the API only
// accepts it when the hub's "Ignore schema validation" setting is ON
// (org/hub admin, DC → hub → Properties). Opt in per environment once that
// setting is enabled; leave it off and the wipe still completes thanks to
// --ignoreError below, just skipping any items it can't strip.
schemaOverride.enabled = ['1', 'true', 'yes'].includes(
  (env('AMPLIENCE_IGNORE_SCHEMA_VALIDATION') ?? '').toLowerCase(),
)

/**
 * A wipe scoped by provenance — one set, or the items no set claims.
 *
 * Separate from the blanket teardown below because almost nothing is shared:
 * this one must leave the map file, the content types and the schemas alone,
 * since the other sets on the hub are still using them. What it does share is
 * the per-item mechanics — unpublish, strip keys, archive.
 */

/** Hub items across every configured repository, active and archived. */
const listEveryItem = async (client, repos) => {
  const all = []
  for (const { id, label } of repos) {
    if (id === undefined) continue
    const repo = await client.contentRepositories.get(id)
    for (const status of ['ACTIVE', 'ARCHIVED']) {
      for (const item of await listAll(repo, status)) all.push({ item, repoLabel: label })
    }
  }
  return all
}

/**
 * Take one item out of service: unpublish it, drop its delivery keys, archive it.
 *
 * 🔴 In that order, and the order is load-bearing. Unpublishing is what
 * retracts the content from Delivery — archiving is a management-side
 * lifecycle change that leaves the published copy serving — and it retracts
 * the key→content entry by matching the key the item still holds. Strip the
 * key first and the item is unpublished under no key, leaving the old one
 * serving its last published snapshot indefinitely: an orphaned key,
 * reclaimable only by putting it on another item, publishing that, and
 * unpublishing it again. Confirmed by Amplience support (2 Oct 2026) as the
 * documented sequence — unpublish, then change or remove the key, then publish.
 *
 * The key strip is the part that matters for a later reseed: an archived item
 * goes on reserving its delivery key hub-wide, so a set wiped without stripping
 * can't be seeded again (409).
 */
const retireItem = async (item) => {
  let current = item.status === 'ARCHIVED' ? await item.related.unarchive() : item
  try {
    if (mayBePublished(current)) await unpublishItem(current)
    if (hasDeliveryKeys(current.body)) {
      current.body._meta.deliveryKey = null
      current.body._meta.deliveryKeys = null
      current = await stripKeys(current)
    }
  } finally {
    // Archive whatever happened above: an item unarchived here and then left
    // active is worse than one that kept its delivery key. A failed strip still
    // throws once this has run, so the caller counts the item as failed and
    // keeps its map entry — the same outcome the blanket wipe's --ignoreError gives.
    await current.related.archive()
  }
}

const readMap = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

const runScopedWipe = async (selector) => {
  const clientId = env('AMPLIENCE_CLIENT_ID')
  const clientSecret = env('AMPLIENCE_CLIENT_SECRET')
  if (clientId === undefined || clientSecret === undefined) {
    console.error(
      '\n✗ A scoped wipe needs AMPLIENCE_CLIENT_ID and AMPLIENCE_CLIENT_SECRET — it has to\n' +
        '  ask the hub what is on it before it can tell one set from another.',
    )
    process.exit(1)
  }

  // The map is the only evidence of where an item came from, and it is
  // machine-local. Without it everything looks hand-authored, so a `--custom`
  // wipe would delete the lot. Refusing is the only safe reading.
  const map = readMap(mapFile)
  if (map === undefined) {
    console.error(
      `\n✗ No import map for "${hubName}" on this machine.\n` +
        `  ${mapFile}\n` +
        '  Without it nothing can be attributed to a set, and every item would look\n' +
        '  hand-authored. Seed from this machine first, or use a blanket wipe.',
    )
    process.exit(1)
  }

  const sets = readAllSets().map((s) => ({ name: s.name, ids: s.ids }))
  if (typeof selector.set === 'string' && !availableSets().includes(selector.set)) {
    console.error(
      `\n✗ Unknown fixture set "${selector.set}" — available: ${availableSets().join(', ')}.`,
    )
    process.exit(1)
  }

  const client = new DynamicContent({ client_id: clientId, client_secret: clientSecret })
  const found = await listEveryItem(client, [
    { id: contentRepo, label: 'content' },
    { id: slotsRepo, label: 'slots' },
    { id: siteComponentsRepo, label: 'site-components' },
  ])

  const classified = classifyHubItems(
    found.map(({ item }) => item),
    map.contentItems ?? [],
    sets,
  )
  const counts = summarise(classified)
  console.log(
    `\n  On this hub: ${counts.total} item(s) — ` +
      Object.entries(counts.bySet)
        .map(([name, n]) => `${name} ${n}`)
        .join(', ') +
      `, orphaned ${counts.orphaned}, custom ${counts.custom}` +
      // Counted apart: archived items serve nothing, and a previous wipe pruned
      // their map entries, so counting them would file them under `custom`.
      (counts.archived > 0 ? `\n  Plus ${counts.archived} archived, serving nothing.` : ''),
  )

  const matched = selectForWipe(classified, selector)
  const describe = selector.custom
    ? 'custom (authored in the DC UI)'
    : selector.orphaned
      ? 'orphaned (seeded from a set no longer on disk)'
      : `the "${selector.set}" set`

  // An item already archived with no delivery keys has been through this
  // before: it serves nothing and reserves nothing, so retiring it again would
  // be churn. One still holding keys has not — an older wipe, or the DC UI,
  // archived it without stripping them, and they stay reserved hub-wide until
  // something takes them off. That one is still worth acting on.
  const selected = matched?.filter((i) => i.status !== 'ARCHIVED' || hasDeliveryKeys(i.body))
  const inert = (matched?.length ?? 0) - (selected?.length ?? 0)

  if (selected === undefined || selected.length === 0) {
    console.log(`\n✓ Nothing to wipe in ${describe}.`)
    if (inert > 0) console.log(`  (${inert} already archived and key-free.)`)
    process.exit(0)
  }
  if (inert > 0) console.log(`\n  Skipping ${inert} already archived and key-free.`)

  // Anything that can't be put back from the repository is listed and left
  // alone until it's asked for a second time. A set is reseedable; `custom` may
  // be the only copy of someone's work, and `orphaned`'s fixtures are gone.
  if (!isRegenerable(selector) && !hasFlag(process.argv, '--apply')) {
    console.log(`\n  Would wipe ${selected.length} item(s) from ${describe}:\n`)
    for (const i of selected) console.log(`    ${i.label ?? '(no label)'}  ${i.id}`)
    console.log(
      '\n  Nothing has been changed. These cannot be restored from the repository —\n' +
        '  re-run with --apply to remove them.',
    )
    process.exit(0)
  }

  console.log(`\nWiping ${selected.length} item(s) from ${describe}…`)
  const byId = new Map(found.map(({ item }) => [item.id, item]))
  const failed = []
  const retired = new Set()
  for (const { id, label } of selected) {
    const live = byId.get(id)
    if (live === undefined) continue
    try {
      await retireItem(live)
      retired.add(id)
    } catch (error) {
      failed.push(`${label ?? id}: ${messageOf(error)}`)
    }
  }

  // Prune only what was actually retired. Left behind, those entries would have
  // a reseed try to update items that are gone. A failed item is the opposite:
  // it still holds its delivery keys, and its map entry is what lets the next
  // seed update it in place rather than create a duplicate that 409s.
  const kept = (map.contentItems ?? []).filter(([, hubId]) => !retired.has(hubId))
  writeFileSync(mapFile, JSON.stringify({ ...map, contentItems: kept }))

  console.log(`✓ Wiped ${retired.size} item(s); their map entries pruned`)
  reportUnpublishing()
  for (const line of failed) console.warn(`  ⚠ ${line}`)
  if (failed.length > 0) {
    console.warn(
      `\n  ${failed.length} item(s) kept their delivery keys and their map entries, so\n` +
        '  re-running this wipe retries them, and a reseed updates them in place.',
    )
  }
  console.log('\n✓ Scoped wipe complete.')
  process.exit(failed.length > 0 ? 1 : 0)
}

if (isScoped) await runScopedWipe(selector)

/** Everything that makes content items go away, and frees their delivery keys. */
const wipeContent = async () => {
  // 1. Delete mapping file
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
    await reclaimRepo(client, contentRepo, 'content')
    await reclaimRepo(client, slotsRepo, 'slots')
    if (siteComponentsRepo !== undefined) {
      await reclaimRepo(client, siteComponentsRepo, 'site-components')
    }
    reportUnpublishing()
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
    ...(schemaOverride.enabled ? ['--ignoreSchemaValidation'] : []),
  ]

  console.log(`\nArchiving all content in content repo (${contentRepo})…`)
  await dcCli('content-item', 'archive', '--repoId', contentRepo, ...archiveFlags)

  console.log(`\nArchiving all content in slots repo (${slotsRepo})…`)
  await dcCli('content-item', 'archive', '--repoId', slotsRepo, ...archiveFlags)

  if (siteComponentsRepo !== undefined) {
    console.log(`\nArchiving all content in Site Components repo (${siteComponentsRepo})…`)
    await dcCli('content-item', 'archive', '--repoId', siteComponentsRepo, ...archiveFlags)
  }
}

/**
 * Archive every content type.
 *
 * DC refuses while content items still reference a type, so the failure is
 * translated rather than passed through raw — the fix is always the same and
 * dc-cli's own message doesn't name it.
 */
const wipeTypes = async () => {
  console.log('\nArchiving all content types…')
  try {
    await dcCli('content-type', 'archive', '-f')
  } catch (error) {
    console.error(
      `\n✗ Could not archive the content types: ${messageOf(error)}\n` +
        '  Content types cannot be archived while content items still use them.\n' +
        '  Run `pnpm hub:wipe:content` first, or `pnpm hub:wipe` to do the lot in order.',
    )
    process.exit(1)
  }
}

/** Archive every content-type schema. Blocked by any surviving content type. */
const wipeSchemas = async () => {
  console.log('\nArchiving all content type schemas…')
  try {
    await dcCli('content-type-schema', 'archive', '-f')
  } catch (error) {
    console.error(
      `\n✗ Could not archive the content type schemas: ${messageOf(error)}\n` +
        '  Schemas cannot be archived while content types still reference them.\n' +
        '  Run `pnpm hub:wipe:types` first, or `pnpm hub:wipe` to do the lot in order.',
    )
    process.exit(1)
  }
}

/**
 * Delete every extension on the hub, seeded or not.
 *
 * Nothing references an extension by id, so DC doesn't block this the way it
 * blocks types and schemas — but content types do reference extensions by
 * name, so until a re-seed any type using one shows a broken editor field.
 */
const wipeExtensions = async () => {
  console.log('\nDeleting all extensions…')
  await dcCli('extension', 'delete', '-f')
}

// Teardown runs in the reverse of the seed order, because DC enforces the
// dependency both ways: an item needs its type, a type needs its schema.
const STEPS = {
  webhooks: wipeWebhooks,
  content: wipeContent,
  types: wipeTypes,
  schemas: wipeSchemas,
  extensions: wipeExtensions,
}
const ALL_STEPS = ['webhooks', 'content', 'types', 'schemas', 'extensions']

for (const name of scope === 'all' ? ALL_STEPS : [scope]) {
  await STEPS[name]()
}

console.log(
  scope === 'all'
    ? '\n✓ Hub wipe complete — run Seed to repopulate from fixtures.'
    : `\n✓ Wiped ${scope}.`,
)
