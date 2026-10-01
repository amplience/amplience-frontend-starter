#!/usr/bin/env node
/**
 * INTERIM (QL-92) — dc-cli import wrapper, superseded by the automation
 * CLI's `frontend-starter schemas push` when QL-58 lands (ADR-0012). The file
 * layout it imports is the layout that CLI will adopt, so retiring this
 * script changes the verb, not the content.
 *
 * Usage:  node scripts/hub-import.mjs [settings|schemas|types|extensions|content|webhooks|all]
 *
 * Import order matters and the script owns it — it mirrors dc-cli's own
 * `hub clone` pipeline (settings → schema → type → extension → content):
 *
 *   1. settings — settings/*.json: preview devices, locales and the
 *                 workflow states. Workflow states come first because both
 *                 the content items and the dashboard extensions reference
 *                 them by id, and dc-cli mints a fresh id per state on each
 *                 new hub — recording the source→target pairing in a
 *                 mapping file the extensions step then reads.
 *   2. schemas  — content-type-schemas/ (partials first is not required;
 *                 dc-cli resolves $refs after registration)
 *   3. types    — content-types/, staged with `${hub}` substituted, then
 *                 imported with --sync so visualization changes reach
 *                 already-registered types
 *   4. extensions — extensions/*.json, staged with hub-independent tokens
 *                 resolved: `${repo:content}` → the content repo, and
 *                 `${status:Label}` → the workflow-state id the settings
 *                 step just created for that label. Depends on settings.
 *   5. webhooks — webhooks/*.json, expanded once per configured web app and
 *                 pushed through the Management API (NOT dc-cli — see below).
 *                 Nothing on the hub depends on a webhook (it points outward,
 *                 at a deployment), so its position is free; it sits here to
 *                 match the order the Environment Manager lists resources in.
 *                 One consequence of being before content: the content step
 *                 publishes, so a seed fires the webhooks it just created —
 *                 harmless (a revalidate is idempotent and cheap) and useful,
 *                 since a wrong secret shows up in the hub's delivery log
 *                 during the seed rather than the next time an editor
 *                 publishes.
 *   6. content  — fixtures imported leaf-first (components → slots →
 *                 pages) so the mapping file already knows every link
 *                 target when the linking item arrives.
 *
 * The webhooks step is the one step that doesn't wrap dc-cli.
 * `dc-cli webhook import` discards the top-level `secret` (the HMAC signing
 * key) and filters out every header marked `"secret": true` before creating
 * the webhook — which is exactly the credential a protected endpoint needs,
 * so a webhook seeded through dc-cli arrives unauthenticated and 401s on
 * every delivery. `dc-management-sdk-js` is already a direct dependency here,
 * so the step uses the API directly: secrets survive, `active: false` becomes
 * expressible, and identity is the webhook's label rather than a mapping
 * file. See webhooks/README.md.
 *
 * All three content phases share one explicit --mapFile
 * (~/.amplience/imports/quadratic-<hubName>.json). dc-cli's default would
 * be a mapping file *per repository*, which breaks cross-repo links —
 * pages (content repo) link slots (slots repo) link components (content
 * repo) — by nulling any reference whose target lives in another repo's
 * map. The shared map is also what makes re-runs update items in place
 * rather than duplicate them.
 *
 * dc-cli exits 0 on some import failures (e.g. LINKED_CONTENT_ITEMS_NOT_
 * FOUND aborts), so this script also scans dc-cli's output and fails the
 * run when an ERROR line went past.
 *
 * Configuration comes from the environment — the package scripts load
 * `packages/hub-management/.env` when present (node --env-file-if-exists; see
 * .env.example), and plain exported variables work the same way:
 *
 *   AMPLIENCE_HUB_NAME       hub name — visualization URIs + map-file name
 *   SITE_NAME                the site namespace the seeded keys live under
 *                            (ADR-0014) — fixtures are authored under the
 *                            fixture site's own name (frontend-starter/…) and the
 *                            content step re-prefixes them to
 *                            <SITE_NAME>/… while staging, the same way the
 *                            types step fills ${hub}. Defaults to
 *                            AMPLIENCE_HUB_NAME — the same default the web
 *                            app's resolveContentConfig applies, so a hub
 *                            and its deployment agree without either
 *                            setting it. Set it explicitly for a site not
 *                            named after its hub.
 *   LOCALHOST_URL            localhost origin — fills ${localhostUrl} in viz URIs (default: http://localhost:3000)
 *   AMPLIENCE_REPO_CONTENT   repository id for pages + components (content step)
 *   AMPLIENCE_REPO_SLOTS     repository id for slots (content step)
 *   AMPLIENCE_CLIENT_ID      ┐ optional — when all three are set they're
 *   AMPLIENCE_CLIENT_SECRET  │ passed to dc-cli; otherwise dc-cli's own
 *   AMPLIENCE_HUB_ID         ┘ active configuration is used. The webhooks
 *                            step is the exception: it calls the Management
 *                            API directly, so it needs all three explicitly
 *                            and says so rather than falling back silently.
 *   AMPLIENCE_REVALIDATE_SECRET  fills ${secret:revalidate} in webhook
 *                            definitions — the shared secret the deployment's
 *                            /api/revalidate-* routes check. Unset means the
 *                            webhooks needing it are skipped with a warning,
 *                            never seeded unauthenticated.
 *
 * Items are imported with --publish (QL-92 decision): the production
 * delivery path serves them immediately, so QL-44/45 never meet
 * unpublished content. The staging VSE serves latest either way.
 */
import { spawn } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DynamicContent, Webhook } from 'dc-management-sdk-js'

import { describeLocaleFilter, filterLocales } from './lib/locales.mjs'
import {
  buildStatusMap,
  EXTENSION_INSTANCE_FIELDS,
  resolveTokens,
  stripFields,
} from './lib/resolve-placeholders.mjs'
import {
  diffWebhooks,
  expandDefinition,
  MANAGED_LABEL_PREFIX,
  redact,
  requiredSecrets,
  WEBHOOK_INSTANCE_FIELDS,
} from './lib/webhooks.mjs'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const repoRoot = path.join(packageRoot, '..', '..')
const fixturesRoot = path.join(packageRoot, '..', 'content', 'fixtures')
const stagingRoot = path.join(packageRoot, '.import')

/**
 * The set seeded when nothing says otherwise — the twin of FIXTURE_SITE_NAME in
 * packages/content/src/config.ts, which is what a zero-config deployment reads.
 * Duplicated rather than imported because this script is plain ESM and that is
 * TypeScript; a mismatch is caught the moment the set doesn't exist on disk.
 */
const DEFAULT_FIXTURE_SET = 'frontend-starter'

/** Set directories on disk — a directory is a set when it holds a set.json. */
const availableSets = () =>
  readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(fixturesRoot, e.name, 'set.json')))
    .map((e) => e.name)
    .sort()

/**
 * Load webApps for a given hub name from amplience.config.json.
 * Falls back to the example config if the real one isn't present.
 * Returns an empty array if the config can't be found or the hub isn't listed.
 */
function loadWebApps(hubName) {
  const configPath = existsSync(path.join(repoRoot, 'amplience.config.json'))
    ? path.join(repoRoot, 'amplience.config.json')
    : path.join(repoRoot, 'amplience.config.example.json')
  if (!existsSync(configPath)) return []
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    const envEntry = config.environments?.find((e) => e.hubName === hubName)
    return envEntry?.webApps ?? []
  } catch {
    return []
  }
}

const argv = process.argv.slice(2)

/** `--set <name>` or `--set=<name>`, anywhere in the arguments. */
const flagValue = (name) => {
  const i = argv.indexOf(name)
  if (i !== -1) return argv[i + 1]
  const inline = argv.find((a) => a.startsWith(`${name}=`))
  return inline?.slice(name.length + 1)
}

/** The first bare argument, skipping flags and the value that follows `--set`. */
const positional = () => {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      if (arg === '--set') i++ // its value, not a step
      continue
    }
    return arg
  }
  return undefined
}

const step = positional() ?? 'all'
const steps = ['settings', 'schemas', 'types', 'extensions', 'webhooks', 'content', 'all']
if (!steps.includes(step)) {
  console.error(`Unknown step "${step}" — expected one of: ${steps.join(', ')}`)
  process.exit(1)
}

const setName = flagValue('--set') ?? process.env.FIXTURE_SET ?? DEFAULT_FIXTURE_SET
if (!availableSets().includes(setName)) {
  console.error(
    `Unknown fixture set "${setName}" — available: ${availableSets().join(', ')}.\n` +
      'Pass --set <name>, or set FIXTURE_SET.',
  )
  process.exit(1)
}
const fixturesDir = path.join(fixturesRoot, setName)
const fixtureSet = JSON.parse(readFileSync(path.join(fixturesDir, 'set.json'), 'utf8'))

const env = (name) => {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
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

const require_ = (name, why) => {
  const value = env(name)
  if (value === undefined) {
    console.error(`${name} is not set — needed to ${why}.`)
    process.exit(1)
  }
  return value
}

/**
 * Run dc-cli, streaming its output while also scanning it: dc-cli exits 0
 * on some failures, so an "ERROR" line in the stream is treated as one.
 */
const dcCli = (...args) =>
  new Promise((resolve) => {
    // Credential flags are appended after this log line, so secrets never echo.
    console.log(`\n→ dc-cli ${args.join(' ')}`)
    const child = spawn('dc-cli', [...args, ...credentialFlags()], {
      // Inherit stdin only under a real TTY (interactive `pnpm hub:import`), so
      // any dc-cli prompt can be answered. When spawned without a TTY (e.g. by
      // the environment-manager), stdin is a pipe that never closes, so an
      // inherited prompt would block forever — give dc-cli no stdin instead so
      // a prompt reads EOF and falls through to its default. (Note: this is a
      // general safeguard; the known content-type-import stall is a schema
      // dependency, not a prompt — see the ordering note on the sync steps.)
      stdio: [process.stdin.isTTY ? 'inherit' : 'ignore', 'pipe', 'pipe'],
      shell: false,
    })
    let sawError = false
    let sawDuplicateKeys = false
    const watch = (stream, sink) => {
      stream.on('data', (chunk) => {
        const text = chunk.toString()
        if (text.includes('ERROR') || text.includes('Error: ') || text.includes('failed, aborting'))
          sawError = true
        if (text.includes('CONTENT_ITEM_DELIVERY_KEYS_DUPLICATE')) sawDuplicateKeys = true
        sink.write(text)
      })
    }
    watch(child.stdout, process.stdout)
    watch(child.stderr, process.stderr)
    child.on('error', () => {
      console.error(
        'Could not run dc-cli. It is a devDependency of @amplience/frontend-starter-schemas — run this script via pnpm (e.g. `pnpm hub:import`) so node_modules/.bin is on the PATH.',
      )
      process.exit(1)
    })
    child.on('close', (code) => {
      if (code !== 0 || sawError) {
        if (sawDuplicateKeys) {
          console.error(
            '\nℹ CONTENT_ITEM_DELIVERY_KEYS_DUPLICATE: an item already on the hub ' +
              '(possibly archived — archived items keep their delivery keys reserved) ' +
              'holds a key this import needs, and the dc-cli map does not reference it. ' +
              'Run hub:wipe (which frees delivery keys, including on archived items) ' +
              'and re-seed, or remove the key from the conflicting item in DC.',
          )
        }
        console.error(`\n✗ dc-cli reported a failure (exit ${code ?? 'unknown'}) — aborting.`)
        process.exit(code === 0 || code === null ? 1 : code)
      }
      resolve()
    })
  })

/**
 * Where dc-cli records the workflow-state source→target id mapping. Kept
 * separate from the content map (quadratic-<hub>.json) so a content wipe
 * never drops the status mappings the extensions step depends on. Keyed by
 * hub so parallel hubs don't collide.
 */
// Filename keeps the `quadratic-` prefix for the same reason as the content map above.
const settingsMapFile = () => {
  const key = env('AMPLIENCE_HUB_NAME') ?? env('AMPLIENCE_HUB_ID') ?? 'default'
  return path.join(os.homedir(), '.amplience', 'imports', `quadratic-settings-${key}.json`)
}

/** The single settings definition file (settings/*.json). Fail-loud otherwise. */
const settingsFile = () => {
  const dir = path.join(packageRoot, 'settings')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []
  if (files.length !== 1) {
    console.error(
      `Expected exactly one settings/*.json file, found ${files.length} — ` +
        `the settings step imports a single hub-settings definition.`,
    )
    process.exit(1)
  }
  return path.join(dir, files[0])
}

const importSettings = async () => {
  // -f overwrites existing workflow states without prompting (non-interactive).
  // The mapFile captures each state's source→target id for the extensions step.
  await dcCli('settings', 'import', settingsFile(), '--mapFile', settingsMapFile(), '-f')
}

const importExtensions = async () => {
  const hubName = env('AMPLIENCE_HUB_NAME')
  const repoContent = env('AMPLIENCE_REPO_CONTENT')
  const repoSiteComponents = env('AMPLIENCE_REPO_SITE_COMPONENTS')

  // Join the settings definition (label → source id) with the map the
  // settings step wrote (source id → target id) to get label → target id.
  // Missing pieces are not fatal here: resolveTokens fails loud per-file
  // only if an extension actually references a status it can't resolve.
  const mapPath = settingsMapFile()
  const settingsMap = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {}
  const settingsJson = JSON.parse(readFileSync(settingsFile(), 'utf8'))
  const statusMap = buildStatusMap(settingsJson, settingsMap)

  const source = path.join(packageRoot, 'extensions')
  const staged = path.join(stagingRoot, 'extensions')
  rmSync(staged, { recursive: true, force: true })
  mkdirSync(staged, { recursive: true })

  for (const file of readdirSync(source).filter((f) => f.endsWith('.json'))) {
    // Drop instance fields (hubId, audit stamps, status) so the checked-in
    // definition is hub-independent, then resolve its ${…} tokens for this hub.
    const definition = stripFields(
      JSON.parse(readFileSync(path.join(source, file), 'utf8')),
      EXTENSION_INSTANCE_FIELDS,
    )
    let resolved
    try {
      resolved = resolveTokens(JSON.stringify(definition, null, 2), {
        hub: hubName,
        repoContent,
        repoSiteComponents,
        statusMap,
        source: file,
      })
    } catch (err) {
      console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }
    // Parse-trip so a malformed resolution fails here, not inside dc-cli.
    writeFileSync(path.join(staged, file), JSON.stringify(JSON.parse(resolved), null, 2) + '\n')
  }

  await dcCli('extension', 'import', staged)
}

const importSchemas = async () => {
  await dcCli('content-type-schema', 'import', path.join(packageRoot, 'content-type-schemas'))
}

const importTypes = async () => {
  const hubName = require_('AMPLIENCE_HUB_NAME', 'fill the ${hub} token in visualization URIs')
  let localhostUrl = env('LOCALHOST_URL') ?? 'http://localhost:3000'
  while (localhostUrl.endsWith('/')) localhostUrl = localhostUrl.slice(0, -1)

  // Additional deployed sites — sourced from amplience.config.json at import time.
  // Strip trailing slashes from each URL for consistency.
  const webApps = loadWebApps(hubName).map((site) => ({
    ...site,
    url: site.url.replace(/\/+$/, ''),
  }))
  if (webApps.length > 0) {
    console.log(`\n→ Found ${webApps.length} additional web app(s) for hub "${hubName}":`)
    for (const site of webApps)
      console.log(`  • ${site.label !== '' ? `Web (${site.label})` : 'Web'} — ${site.url}`)
  }

  const source = path.join(packageRoot, 'content-types')
  const staged = path.join(stagingRoot, 'content-types')
  rmSync(staged, { recursive: true, force: true })
  mkdirSync(staged, { recursive: true })

  for (const file of readdirSync(source)) {
    // Parse as JSON so we can mutate the visualizations array cleanly.
    const raw = readFileSync(path.join(source, file), 'utf8')
    const data = JSON.parse(
      raw.replaceAll('${hub}', hubName).replaceAll('${localhostUrl}', localhostUrl),
    )

    // If there's at least one webApp, inject a custom card thumbnail using the first one's URL.
    if (webApps.length > 0) {
      const firstWebAppUrl = webApps[0].url
      const cards = ((data.settings ??= {}).cards ??= [])
      cards[0] ??= {}
      data.settings.cards[0].templatedUri = `${firstWebAppUrl}/visualization?vse={{vse.domain}}&content={{content.sys.id}}&isThumbnail=true`
    }

    // Inject one Web (label) entry per webApp, immediately after the localhost entry.
    const visualisations = data.settings?.visualizations
    if (Array.isArray(visualisations) && webApps.length > 0) {
      const localhostIdx = visualisations.findIndex((v) => v.label === 'Web (localhost)')
      const insertAt = localhostIdx >= 0 ? localhostIdx : visualisations.length - 1
      const extra = webApps.map((site) => ({
        label: site.label !== '' ? `Web (${site.label})` : 'Web',
        templatedUri: `${site.url}/visualization?vse={{vse.domain}}&content={{content.sys.id}}`,
        default: false,
      }))
      visualisations.splice(insertAt, 0, ...extra)
    }

    writeFileSync(path.join(staged, file), JSON.stringify(data, null, 2) + '\n')
  }

  await dcCli('content-type', 'import', staged, '--sync')
}

/**
 * dc-cli only considers an item publishable when the *source file* carries a
 * `lastPublishedDate` (its import maps it to `lastPublish`, and
 * `itemShouldPublish` requires it — even under --republish). That field is
 * an export artefact meaning "was published at source"; hand-authored
 * fixtures never have it, so without help nothing would ever publish.
 *
 * Staging injects a fixed date far in the past, which lands exactly the
 * semantics we want from `--publish`:
 *   - item changed this run            → publishes (updated)
 *   - item never published on the hub  → publishes (no target date)
 *   - item unchanged + already published → skipped (target date is newer)
 * AMPLIENCE_REPUBLISH=1 still force-publishes everything.
 */
const PUBLISH_MARKER_DATE = '2000-01-01T00:00:00.000Z'

const markStagedItemsPublishable = (dir) => {
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const file = path.join(entry.parentPath ?? entry.path, entry.name)
    const item = JSON.parse(readFileSync(file, 'utf8'))
    if (item.lastPublishedDate === undefined) {
      item.lastPublishedDate = PUBLISH_MARKER_DATE
      writeFileSync(file, JSON.stringify(item, null, 2))
    }
  }
}

/**
 * Fixtures are authored under their own set's namespace (`<set>/…`, ADR-0014),
 * and seeding re-prefixes every delivery key to the chosen SITE_NAME while
 * staging, so the hub's keys match what the deployment will ask for. Seeding
 * with SITE_NAME equal to the set name is the identity case.
 *
 * A key that doesn't carry the set's prefix throws rather than being skipped.
 * The old silent skip was how a second set could seed half-namespaced: its keys
 * would land unprefixed, collide across sites, and only show up as a 404 much
 * later.
 */
const namespaceStagedDeliveryKeys = (dir, fromPrefix, siteName) => {
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const file = path.join(entry.parentPath ?? entry.path, entry.name)
    const item = JSON.parse(readFileSync(file, 'utf8'))
    const values = item.body?._meta?.deliveryKeys?.values
    if (!Array.isArray(values)) continue
    let changed = false
    for (const v of values) {
      if (typeof v.value !== 'string') continue
      if (!v.value.startsWith(fromPrefix)) {
        console.error(
          `\n✗ ${path.relative(stagingRoot, file)} has delivery key "${v.value}", which is ` +
            `not under "${fromPrefix}".\n` +
            `  Every key in the "${setName}" set must start with that prefix, or it can't be ` +
            're-namespaced and would seed into the wrong site.',
        )
        process.exit(1)
      }
      v.value = `${siteName}/${v.value.slice(fromPrefix.length)}`
      changed = true
    }
    if (changed) writeFileSync(file, JSON.stringify(item, null, 2))
  }
}

/**
 * The hub's configured locales, or undefined when we can't ask.
 *
 * Locales are a property of the hub (ADR-0019), so the seed reads them rather
 * than assuming. The probe needs Management API credentials, which the content
 * step doesn't otherwise require — without them we seed unfiltered, which is
 * exactly the old behaviour, so a partial credential set is never worse than
 * before.
 */
const probeHubLocales = async () => {
  const clientId = env('AMPLIENCE_CLIENT_ID')
  const clientSecret = env('AMPLIENCE_CLIENT_SECRET')
  const hubId = env('AMPLIENCE_HUB_ID')
  if (!clientId || !clientSecret || !hubId) return undefined
  try {
    const client = new DynamicContent({ client_id: clientId, client_secret: clientSecret })
    const hub = await client.hubs.get(hubId)
    const locales = hub.settings?.localization?.locales
    return Array.isArray(locales) && locales.length > 0 ? locales : undefined
  } catch (err) {
    console.warn(
      `  ! Could not read the hub's locales (${err instanceof Error ? err.message : String(err)}) — ` +
        'seeding every authored locale.',
    )
    return undefined
  }
}

/** Drop authored locales the hub doesn't have, across a staged phase. */
const filterStagedLocales = (dir, hubLocales) => {
  const kept = new Set()
  const dropped = new Set()
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const file = path.join(entry.parentPath ?? entry.path, entry.name)
    const item = JSON.parse(readFileSync(file, 'utf8'))
    const result = filterLocales(item, hubLocales)
    for (const l of result.kept) kept.add(l)
    for (const l of result.dropped) dropped.add(l)
    if (result.emptied.length > 0) {
      console.error(
        `\n✗ ${path.relative(stagingRoot, file)} would seed with empty localized ` +
          `field(s): ${result.emptied.join(', ')}.\n` +
          `  None of its authored locales are on this hub (${hubLocales.join(', ')}), so the ` +
          'item would exist with nothing to render.',
      )
      process.exit(1)
    }
    if (result.changed) writeFileSync(file, JSON.stringify(item, null, 2))
  }
  return { kept, dropped }
}

const importContent = async () => {
  const hubName = require_('AMPLIENCE_HUB_NAME', 'name the shared mapping file')
  // The set name, not the hub name (ADR-0019, amending ADR-0014): a hub can
  // carry several sets, so defaulting to the hub would have them all claim one
  // namespace. The deployment's resolveContentConfig applies the same default.
  const siteName = env('SITE_NAME') ?? setName

  // Seeding a set into a namespace that belongs to *another set* is almost
  // always a stale SITE_NAME rather than an intention: the keys collide and the
  // hub rejects the import partway through, which reads as a bug in the fixture
  // rather than a configuration mistake. Naming a site after no set at all
  // (a partner's own name) is the normal override and passes through.
  if (siteName !== setName && availableSets().includes(siteName)) {
    console.error(
      `\n✗ SITE_NAME is "${siteName}", which is another fixture set's own namespace.\n` +
        `  Seeding "${setName}" there would collide with "${siteName}"'s delivery keys.\n` +
        `  Unset SITE_NAME to seed "${setName}" into "${setName}/", or choose a name that\n` +
        "  isn't a set (e.g. a partner's site name).",
    )
    process.exit(1)
  }

  const contentRepo = require_('AMPLIENCE_REPO_CONTENT', 'target the content repository')
  const slotsRepo = require_('AMPLIENCE_REPO_SLOTS', 'target the slots repository')
  // Optional — only seeded when the deployment uses CMS-managed site config.
  const siteComponentsRepo = env('AMPLIENCE_REPO_SITE_COMPONENTS')

  // --publish only queues items the run created or changed; when the hub
  // already matches the fixtures (e.g. recovering from a run that imported
  // but failed before publishing), AMPLIENCE_REPUBLISH=1 forces a publish
  // of every imported item regardless.
  const publishFlags = env('AMPLIENCE_REPUBLISH') ? ['--publish', '--republish'] : ['--publish']

  // One map across all phases and repositories (see module doc).
  // Filename keeps the `quadratic-` prefix: renaming it orphans every existing hub's map, so dc-cli would re-import the whole model as duplicates.
  const mapFile = path.join(os.homedir(), '.amplience', 'imports', `quadratic-${hubName}.json`)

  // Leaf-first phases: an item is only ever imported after everything it
  // links to, so reference rewriting always finds its target in the map.
  const phases = [
    { dir: 'components', repo: contentRepo },
    { dir: 'slots', repo: slotsRepo },
    { dir: 'pages', repo: contentRepo },
  ]
  // Site Components is standalone (nothing links to or from it), so its order
  // in the leaf-first sequence is irrelevant. Seed it only when both the repo
  // is configured and the deployment actually ships fixtures for it — absent
  // either, the feature simply isn't in use and the phase is skipped.
  if (siteComponentsRepo && existsSync(path.join(fixturesDir, 'site-components'))) {
    phases.push({ dir: 'site-components', repo: siteComponentsRepo })
  }
  // A mis-targeted seed is expensive to undo, so say what this run is about to
  // do before it does any of it.
  console.log(
    `\n→ Seeding the "${setName}" fixture set into "${siteName}/" on hub "${hubName}"` +
      `${siteName === setName ? '' : ' [SITE_NAME override]'}` +
      `${siteComponentsRepo ? ' (with site components)' : ''}`,
  )

  const hubLocales = await probeHubLocales()
  if (hubLocales === undefined) {
    console.log('  locales: not read (no Management API credentials) — seeding all authored')
  } else {
    console.log(`  locales: ${hubLocales.join(', ')} (from the hub)`)
    if (!hubLocales.includes(fixtureSet.defaultLocale)) {
      console.error(
        `\n✗ This hub has no "${fixtureSet.defaultLocale}", the locale every field in the ` +
          `"${setName}" set is authored in.\n` +
          `  Seeding would produce a site of empty fields. Add it to the hub, or seed a set ` +
          'whose default locale it has.',
      )
      process.exit(1)
    }
  }

  const localeTally = { kept: new Set(), dropped: new Set() }

  for (const { dir, repo } of phases) {
    // Staged per set, so seeding a second set doesn't clobber the first's
    // staging directory mid-run.
    const staged = path.join(stagingRoot, setName, `items-${dir}`)
    rmSync(staged, { recursive: true, force: true })
    mkdirSync(staged, { recursive: true })
    cpSync(path.join(fixturesDir, dir), staged, { recursive: true })
    namespaceStagedDeliveryKeys(staged, `${setName}/`, siteName)
    if (hubLocales !== undefined) {
      const { kept, dropped } = filterStagedLocales(staged, hubLocales)
      for (const l of kept) localeTally.kept.add(l)
      for (const l of dropped) localeTally.dropped.add(l)
    }
    markStagedItemsPublishable(staged)
    await dcCli(
      'content-item',
      'import',
      staged,
      '--baseRepo',
      repo,
      '--mapFile',
      mapFile,
      '-f',
      ...publishFlags,
    )
  }

  const summary = describeLocaleFilter(localeTally, fixtureSet.authoredLocales?.length ?? 0)
  if (summary) console.log(`\n  ${summary}`)
}

/**
 * Named secrets available to webhook definitions, by token name.
 * A token whose value is absent skips the definition using it (see below),
 * so this map is the whole vocabulary of `${secret:…}`.
 */
const webhookSecrets = () => {
  const map = new Map()
  const revalidate = env('AMPLIENCE_REVALIDATE_SECRET')
  if (revalidate !== undefined) map.set('revalidate', revalidate)
  return map
}

/** Env var behind each secret token, for messages that tell you what to set. */
const SECRET_ENV = { revalidate: 'AMPLIENCE_REVALIDATE_SECRET' }

/** Every webhook on the hub, collected before mutating (pages would shift). */
const listAllWebhooks = async (hub) => {
  const all = []
  for (let page = 0; ; page++) {
    const result = await hub.related.webhooks.list({ size: 100, page })
    all.push(...result.getItems())
    if (page >= (result.page?.totalPages ?? 1) - 1) break
  }
  return all
}

const importWebhooks = async () => {
  const hubName = require_('AMPLIENCE_HUB_NAME', "resolve ${hub} and find this hub's web apps")
  // Unlike the dc-cli steps, this one has no "active configuration" to fall
  // back on — it authenticates itself, so it asks for credentials plainly.
  const clientId = require_('AMPLIENCE_CLIENT_ID', 'call the Management API for webhooks')
  const clientSecret = require_('AMPLIENCE_CLIENT_SECRET', 'call the Management API for webhooks')
  const hubId = require_('AMPLIENCE_HUB_ID', 'identify the hub to attach webhooks to')

  const source = path.join(packageRoot, 'webhooks')
  const files = existsSync(source) ? readdirSync(source).filter((f) => f.endsWith('.json')) : []
  if (files.length === 0) {
    console.log('\n→ No webhook definitions in webhooks/ — nothing to seed.')
    return
  }

  // A webhook points at a deployment. With none registered against this hub
  // there is no URL to send anything to, so this is a skip, not a failure.
  const webApps = loadWebApps(hubName).map((site) => ({
    ...site,
    url: site.url.replace(/\/+$/, ''),
  }))
  if (webApps.length === 0) {
    console.log(
      `\n→ Hub "${hubName}" has no web apps registered in amplience.config.json — ` +
        `skipping webhooks (a webhook needs a deployment to call). Add a site in the ` +
        `Environment Manager, then re-run this step.`,
    )
    return
  }
  console.log(
    `\n→ Expanding ${files.length} webhook definition(s) across ${webApps.length} web app(s)`,
  )

  const secrets = webhookSecrets()
  const desired = []
  for (const file of files) {
    const definition = stripFields(
      JSON.parse(readFileSync(path.join(source, file), 'utf8')),
      WEBHOOK_INSTANCE_FIELDS,
    )
    // Skip rather than fail: a deployment that doesn't use the feature behind
    // this webhook shouldn't be unable to run `pnpm hub:import`. Seeding it
    // without its secret would be worse than skipping — it would 401 on every
    // delivery and look like a broken integration.
    const missing = [...requiredSecrets(definition)].filter((name) => !secrets.has(name))
    if (missing.length > 0) {
      console.log(
        `  ⚠ ${file}: skipped — ${missing
          .map((n) => SECRET_ENV[n] ?? `\${secret:${n}}`)
          .join(', ')} not set. Set it to seed this webhook (it authenticates the call).`,
      )
      continue
    }
    try {
      desired.push(
        ...expandDefinition(definition, { webApps, hub: hubName, secrets, source: file }),
      )
    } catch (err) {
      console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }
  }
  if (desired.length === 0) {
    console.log('  Nothing to seed.')
    return
  }

  const client = new DynamicContent({ client_id: clientId, client_secret: clientSecret })
  let hub
  try {
    hub = await client.hubs.get(hubId)
  } catch (err) {
    console.error(
      `\n✗ Could not read hub ${hubId}: ${err instanceof Error ? err.message : String(err)}`,
    )
    process.exit(1)
  }

  const existing = await listAllWebhooks(hub)
  const { create, update, prune } = diffWebhooks(desired, existing)
  const unmanaged = existing.length - (update.length + prune.length)
  console.log(
    `  ${create.length} to create, ${update.length} to update, ${prune.length} to remove` +
      (unmanaged > 0 ? `, ${unmanaged} left alone (not "${MANAGED_LABEL_PREFIX}…")` : ''),
  )

  try {
    for (const webhook of create) {
      await hub.related.webhooks.create(new Webhook(webhook))
      console.log(`  + ${webhook.label} → ${(webhook.handlers ?? []).join(', ')}`)
    }
    for (const webhook of update) {
      const { id, ...body } = webhook
      const target = existing.find((w) => w.id === id)
      await target.related.update(new Webhook(body))
      console.log(`  ~ ${webhook.label} → ${(body.handlers ?? []).join(', ')}`)
    }
    // A webhook outliving its deployment fires on every publish and fails
    // every time, so a site that's been renamed or destroyed takes its
    // webhook with it.
    for (const webhook of prune) {
      await webhook.related.delete()
      console.log(`  - ${webhook.label} (no web app claims it any more)`)
    }
  } catch (err) {
    console.error(`\n✗ Webhook write failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  if (env('AMPLIENCE_WEBHOOK_DEBUG') !== undefined) {
    console.log('\n  Resolved definitions (secrets masked):')
    for (const webhook of desired) console.log(`  ${JSON.stringify(redact(webhook))}`)
  }
}

if (step === 'settings' || step === 'all') await importSettings()
if (step === 'schemas' || step === 'all') await importSchemas()
if (step === 'types' || step === 'all') await importTypes()
if (step === 'extensions' || step === 'all') await importExtensions()
if (step === 'webhooks' || step === 'all') await importWebhooks()
if (step === 'content' || step === 'all') await importContent()

console.log('\n✓ hub-import complete')
