#!/usr/bin/env node
/**
 * INTERIM (QL-92) — dc-cli import wrapper, superseded by the automation
 * CLI's `quadratic schemas push` when QL-58 lands (ADR-0012). The file
 * layout it imports is the layout that CLI will adopt, so retiring this
 * script changes the verb, not the content.
 *
 * Usage:  node scripts/hub-import.mjs [settings|schemas|types|extensions|content|all]
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
 *   5. content  — fixtures imported leaf-first (components → slots →
 *                 pages) so the mapping file already knows every link
 *                 target when the linking item arrives.
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
 *                            fixture site's own name (base-site/…) and the
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
 *   AMPLIENCE_HUB_ID         ┘ active configuration is used
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

import {
  buildStatusMap,
  EXTENSION_INSTANCE_FIELDS,
  resolveTokens,
  stripFields,
} from './lib/resolve-placeholders.mjs'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const repoRoot = path.join(packageRoot, '..', '..')
const fixturesDir = path.join(packageRoot, '..', 'content', 'fixtures', 'base-site')
const stagingDir = path.join(packageRoot, '.import')

/**
 * Load webApps for a given hub name from quadratic.config.json.
 * Falls back to the example config if the real one isn't present.
 * Returns an empty array if the config can't be found or the hub isn't listed.
 */
function loadWebApps(hubName) {
  const configPath = existsSync(path.join(repoRoot, 'quadratic.config.json'))
    ? path.join(repoRoot, 'quadratic.config.json')
    : path.join(repoRoot, 'quadratic.config.example.json')
  if (!existsSync(configPath)) return []
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    const envEntry = config.environments?.find((e) => e.hubName === hubName)
    return envEntry?.webApps ?? []
  } catch {
    return []
  }
}

const step = process.argv[2] ?? 'all'
const steps = ['settings', 'schemas', 'types', 'extensions', 'content', 'all']
if (!steps.includes(step)) {
  console.error(`Unknown step "${step}" — expected one of: ${steps.join(', ')}`)
  process.exit(1)
}

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
      stdio: ['inherit', 'pipe', 'pipe'],
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
        'Could not run dc-cli. It is a devDependency of @amplience/quadratic-schemas — run this script via pnpm (e.g. `pnpm hub:import`) so node_modules/.bin is on the PATH.',
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

  // Join the settings definition (label → source id) with the map the
  // settings step wrote (source id → target id) to get label → target id.
  // Missing pieces are not fatal here: resolveTokens fails loud per-file
  // only if an extension actually references a status it can't resolve.
  const mapPath = settingsMapFile()
  const settingsMap = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {}
  const settingsJson = JSON.parse(readFileSync(settingsFile(), 'utf8'))
  const statusMap = buildStatusMap(settingsJson, settingsMap)

  const source = path.join(packageRoot, 'extensions')
  const staged = path.join(stagingDir, 'extensions')
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

  // Additional deployed sites — sourced from quadratic.config.json at import time.
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
  const staged = path.join(stagingDir, 'content-types')
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
 * Fixtures are authored under the fixture site's own namespace
 * (`base-site/…`, ADR-0014). Seeding a hub re-prefixes every delivery key
 * to the chosen SITE_NAME while staging, so the hub's keys match what the
 * deployment (whose SITE_NAME must be the same value) will ask for. Seeding
 * with SITE_NAME=base-site is simply the identity case.
 */
const FIXTURE_SITE_PREFIX = 'base-site/'

const namespaceStagedDeliveryKeys = (dir, siteName) => {
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const file = path.join(entry.parentPath ?? entry.path, entry.name)
    const item = JSON.parse(readFileSync(file, 'utf8'))
    const values = item.body?._meta?.deliveryKeys?.values
    if (!Array.isArray(values)) continue
    let changed = false
    for (const v of values) {
      if (typeof v.value === 'string' && v.value.startsWith(FIXTURE_SITE_PREFIX)) {
        v.value = `${siteName}/${v.value.slice(FIXTURE_SITE_PREFIX.length)}`
        changed = true
      }
    }
    if (changed) writeFileSync(file, JSON.stringify(item, null, 2))
  }
}

const importContent = async () => {
  const hubName = require_('AMPLIENCE_HUB_NAME', 'name the shared mapping file')
  // Same default the web app's resolveContentConfig applies (ADR-0014) —
  // seed and deployment agree on the namespace without a second variable.
  const siteName = env('SITE_NAME') ?? hubName
  console.log(`\n→ Seeding delivery keys under the "${siteName}/" site namespace`)
  const contentRepo = require_('AMPLIENCE_REPO_CONTENT', 'target the content repository')
  const slotsRepo = require_('AMPLIENCE_REPO_SLOTS', 'target the slots repository')

  // --publish only queues items the run created or changed; when the hub
  // already matches the fixtures (e.g. recovering from a run that imported
  // but failed before publishing), AMPLIENCE_REPUBLISH=1 forces a publish
  // of every imported item regardless.
  const publishFlags = env('AMPLIENCE_REPUBLISH') ? ['--publish', '--republish'] : ['--publish']

  // One map across all phases and repositories (see module doc).
  const mapFile = path.join(os.homedir(), '.amplience', 'imports', `quadratic-${hubName}.json`)

  // Leaf-first phases: an item is only ever imported after everything it
  // links to, so reference rewriting always finds its target in the map.
  const phases = [
    { dir: 'components', repo: contentRepo },
    { dir: 'slots', repo: slotsRepo },
    { dir: 'pages', repo: contentRepo },
  ]
  for (const { dir, repo } of phases) {
    const staged = path.join(stagingDir, `items-${dir}`)
    rmSync(staged, { recursive: true, force: true })
    mkdirSync(staged, { recursive: true })
    cpSync(path.join(fixturesDir, dir), staged, { recursive: true })
    namespaceStagedDeliveryKeys(staged, siteName)
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
}

if (step === 'settings' || step === 'all') await importSettings()
if (step === 'schemas' || step === 'all') await importSchemas()
if (step === 'types' || step === 'all') await importTypes()
if (step === 'extensions' || step === 'all') await importExtensions()
if (step === 'content' || step === 'all') await importContent()

console.log('\n✓ hub-import complete')
