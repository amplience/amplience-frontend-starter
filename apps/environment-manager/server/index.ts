import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamText } from 'hono/streaming'

import { buildDamCheck, liveGqlFetch } from './dam-permissions.ts'
import { hubManagementEnvVars, updateEnvVars, webEnvVars } from './env-files.ts'
import { buildPermissionsReport, type FetchJson } from './permissions.ts'
import {
  cliAuthTokenPaths,
  deployArgs,
  deriveProjectName,
  envAddArgs,
  envRmArgs,
  extractToken,
  linkArgs,
  nextAvailableName,
  parseDeploymentUrl,
  parseNextCursor,
  parseProjectNames,
  projectListArgs,
  runtimeEnvVars,
  stripAnsi,
  type VercelSiteInput,
} from './vercel.ts'

// ── Paths ─────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// apps/environment-manager/server/ → 3 levels up → repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const HUB_MANAGEMENT_ROOT = path.join(REPO_ROOT, 'packages', 'hub-management')
const CONFIG_PATH = path.join(REPO_ROOT, 'quadratic.config.json')
const WEB_APP_ROOT = path.join(REPO_ROOT, 'apps', 'web')
const WEB_ENV = path.join(WEB_APP_ROOT, '.env')
const HUB_MANAGEMENT_ENV = path.join(HUB_MANAGEMENT_ROOT, '.env')
const PORT = 3099

/** Sentinel name for the built-in "Local Fixtures" entry — never stored in config.json. */
const FIXTURES_NAME = 'fixtures'

// ── Types ─────────────────────────────────────────────────────────────────────

// `name` is the delivery-key namespace (SITE_NAME, ADR-0014); matches the
// field the UI reads/writes and what's stored in quadratic.config.json.
// vercelProjectName/vercelScope are set only for sites provisioned via
// "Create Vercel site" — they're what let the destroy-site endpoint find and
// remove the right Vercel project later.
type WebApp = {
  label: string
  url: string
  brand: string
  name: string
  vercelProjectName?: string
  vercelScope?: string
}

type Environment = {
  name: string
  label: string
  hubName: string
  hubId: string
  localhostUrl: string
  repoContent: string
  repoSlots: string
  /** "Site Components" repo (authoring/permission boundary for CMS site config); "" = unset. */
  repoSiteComponents: string
  /**
   * Shared secret for the deployment's /api/revalidate-* routes, seeded into
   * the webhooks that call them; "" = unset, so those webhooks are skipped
   * rather than seeded unauthenticated (see src/types.ts).
   */
  revalidateSecret: string
  clientId: string
  clientSecret: string
  stagingHost: string
  defaultBrand: string
  /** SITE_NAME for the hub's main frontend (ADR-0014); blank = hub-name default. */
  defaultSite: string
  webApps: WebApp[]
  republish: boolean
  /** Opt-in per environment: allow dc-cli's --ignoreSchemaValidation (see src/types.ts). */
  ignoreSchemaValidation?: boolean
}

type Config = {
  active: string
  environments: Environment[]
  /**
   * Brand the built-in Local Fixtures source renders under — the fixtures
   * equivalent of an environment's defaultBrand. Optional so configs written
   * before fixtures carried a brand still parse; absent means the base theme.
   */
  fixturesBrand?: string
}

// ── Config helpers ────────────────────────────────────────────────────────────

async function readConfig(): Promise<Config> {
  if (!existsSync(CONFIG_PATH)) {
    return { active: FIXTURES_NAME, environments: [], fixturesBrand: '' }
  }
  const raw = await readFile(CONFIG_PATH, 'utf-8')
  return JSON.parse(raw) as Config
}

async function writeConfig(config: Config): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

// ── .env writer ───────────────────────────────────────────────────────────────

/**
 * Write Amplience connection vars to apps/web/.env AND packages/hub-management/.env
 * so that both the web app and the CLI scripts (`pnpm hub:import` etc.) stay in sync
 * with the active environment. Both read a plain `.env` — Next.js ranks an
 * `.env.local` above it, so a stray one would silently outrank what's written here.
 * Pass null (for Fixtures) to comment the connection vars out; the web app falls back to
 * bundled fixture data and CLI commands will have no hub to target. Fixtures still carry
 * a brand, so `fixturesBrand` is what NEXT_PUBLIC_BRAND becomes in that case.
 * The key-by-key mapping lives in ./env-files.ts.
 */
async function writeActiveEnvFiles(env: Environment | null, fixturesBrand: string): Promise<void> {
  // apps/web/.env — only the vars the web app needs
  const existingWeb = existsSync(WEB_ENV) ? await readFile(WEB_ENV, 'utf-8') : ''
  await writeFile(WEB_ENV, updateEnvVars(existingWeb, webEnvVars(env, fixturesBrand)), 'utf-8')

  // packages/hub-management/.env — full set of vars consumed by hub:import / hub:wipe scripts
  const existingHubEnv = existsSync(HUB_MANAGEMENT_ENV)
    ? await readFile(HUB_MANAGEMENT_ENV, 'utf-8')
    : ''
  await writeFile(
    HUB_MANAGEMENT_ENV,
    updateEnvVars(existingHubEnv, hubManagementEnvVars(env)),
    'utf-8',
  )
}

// ── Amplience Management API helpers ─────────────────────────────────────────

const AMPLIENCE_AUTH = 'https://auth.amplience.net/oauth/token'
const AMPLIENCE_API = 'https://api.amplience.net/v2/content'

async function getAmplienceToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(AMPLIENCE_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Amplience auth failed: HTTP ${res.status}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

async function fetchCount(token: string, url: string): Promise<number> {
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}size=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Amplience API ${res.status}: ${url}`)
  const data = (await res.json()) as { page: { totalElements: number } }
  return data.page.totalElements
}

// ── Hub discovery ─────────────────────────────────────────────────────────────

type DiscoveredRepo = { id: string; name: string; label: string; features: string[] }
type DiscoveredHub = {
  id: string
  name: string
  label: string
  repos: DiscoveredRepo[]
  stagingHost?: string
}

/**
 * Fetch the hubs + content repositories accessible to a given credential pair.
 * Uses HAL links from the hub resource so the URLs are API-driven rather than
 * guessed. URI template variables (e.g. {?page,size}) are stripped before use.
 */
async function discoverHubs(clientId: string, clientSecret: string): Promise<DiscoveredHub[]> {
  const token = await getAmplienceToken(clientId, clientSecret)

  const strip = (href: string) => href.replace(/\{[^}]*\}/g, '')

  // List all hubs visible to these credentials
  const hubsRes = await fetch(`${AMPLIENCE_API}/hubs?size=50`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!hubsRes.ok) throw new Error(`Failed to list hubs: HTTP ${hubsRes.status}`)

  const hubsBody = (await hubsRes.json()) as {
    _embedded?: {
      hubs?: {
        id: string
        name: string
        label?: string
        settings?: {
          virtualStagingEnvironment?: { hostname?: string }
          previewVirtualStagingEnvironment?: { hostname?: string }
        }
        _links?: Record<string, { href: string; templated?: boolean }>
      }[]
    }
  }

  const rawHubs = hubsBody._embedded?.hubs ?? []

  return Promise.all(
    rawHubs.map(async (hub): Promise<DiscoveredHub> => {
      // VSE hostname is embedded in hub settings — prefer preview VSE, fall back to standard VSE
      const stagingHost =
        hub.settings?.previewVirtualStagingEnvironment?.hostname ??
        hub.settings?.virtualStagingEnvironment?.hostname

      const base = {
        id: hub.id,
        name: hub.name,
        label: hub.label ?? hub.name,
        ...(stagingHost !== undefined ? { stagingHost } : {}),
      }

      const reposHref = hub._links?.['content-repositories']?.href
      if (!reposHref) {
        return { ...base, repos: [] }
      }

      const reposRes = await fetch(`${strip(reposHref)}?size=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!reposRes.ok) {
        return { ...base, repos: [] }
      }

      const reposBody = (await reposRes.json()) as {
        _embedded?: {
          'content-repositories'?: {
            id: string
            name: string
            label?: string
            features?: string[]
          }[]
        }
      }

      const repos = (reposBody._embedded?.['content-repositories'] ?? []).map(
        (r): DiscoveredRepo => ({
          id: r.id,
          name: r.name,
          label: r.label ?? r.name,
          features: r.features ?? [],
        }),
      )

      return { ...base, repos }
    }),
  )
}

// ── Script runner ─────────────────────────────────────────────────────────────

/**
 * Build the env vars to inject into a spawned script.
 * Spreads process.env so PATH, HOME, etc. are inherited, then layers the
 * selected environment's Amplience credentials on top.
 * dc-cli is a devDependency of packages/hub-management — prepend its bin dir to PATH
 * so node_modules/.bin/dc-cli is found when running scripts directly.
 */
function buildEnv(env: Environment, republish = false): NodeJS.ProcessEnv {
  const dcCliBin = path.join(HUB_MANAGEMENT_ROOT, 'node_modules', '.bin')
  const rootBin = path.join(REPO_ROOT, 'node_modules', '.bin')
  return {
    ...process.env,
    PATH: `${dcCliBin}:${rootBin}:${process.env.PATH ?? ''}`,
    AMPLIENCE_HUB_NAME: env.hubName,
    LOCALHOST_URL: env.localhostUrl,
    AMPLIENCE_REPO_CONTENT: env.repoContent,
    AMPLIENCE_REPO_SLOTS: env.repoSlots,
    // Blank when the deployment has no Site Components repo (feature not in use).
    AMPLIENCE_REPO_SITE_COMPONENTS: env.repoSiteComponents ?? '',
    AMPLIENCE_CLIENT_ID: env.clientId,
    AMPLIENCE_CLIENT_SECRET: env.clientSecret,
    AMPLIENCE_HUB_ID: env.hubId,
    AMPLIENCE_REPUBLISH: republish || env.republish ? '1' : '',
    // Per-environment opt-in; set explicitly (not inherited from a stray shell
    // var) so behaviour is deterministic per hub. Read by hub-wipe.mjs.
    AMPLIENCE_IGNORE_SCHEMA_VALIDATION: env.ignoreSchemaValidation ? '1' : '',
    // Blank = let hub-import apply its own default (the hub name, ADR-0014).
    ...((env.defaultSite ?? '') !== '' && { SITE_NAME: env.defaultSite }),
    // Fills ${secret:revalidate} in webhook definitions. Absent (not empty)
    // when unset, so the webhooks step skips those definitions with a warning
    // instead of seeding a webhook that would 401 on every delivery.
    ...((env.revalidateSecret ?? '') !== '' && {
      AMPLIENCE_REVALIDATE_SECRET: env.revalidateSecret,
    }),
  }
}

type StreamWriter = { write: (text: string) => Promise<unknown> }

/**
 * Active child processes keyed by environment name.
 * Used by the cancel endpoint to kill a running operation.
 */
const runningOps = new Map<string, ReturnType<typeof spawn>>()

/**
 * Spawn an arbitrary command, piping stdout + stderr into the Hono stream.
 * Resolves on clean exit, rejects on non-zero exit or signal kill.
 *
 * - `cwd` defaults to the hub-management root (where the seed/sync scripts run);
 *   Vercel commands pass the web-app root.
 * - `envName`, when set, registers the child in `runningOps` so the existing
 *   cancel endpoint can kill it.
 * - `input`, when set, is written to the child's stdin and the stream closed —
 *   used to feed `vercel env add` its value without exposing it in argv.
 */
function runCommand(
  stream: StreamWriter,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  opts: { cwd?: string; envName?: string; input?: string } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    // detached: true puts the child in its own process group so that a
    // cancel can send SIGKILL to the whole group (node/vercel + grandchildren).
    const child = spawn(command, args, {
      cwd: opts.cwd ?? HUB_MANAGEMENT_ROOT,
      env,
      detached: true,
    })

    if (opts.envName !== undefined) {
      runningOps.set(opts.envName, child)
      console.log(`[runCommand] registered pid=${String(child.pid)} for env="${opts.envName}"`)
    }

    // Feed stdin (if any) and always close it. Closing is essential even with
    // no input: these commands run without a TTY, so if one puts up a prompt
    // (e.g. `vercel env rm` confirming a removal) an open stdin would hang the
    // child forever. EOF makes it abort/skip instead. `vercel env add` reads
    // its value from stdin, so the write must precede the end().
    if (opts.input !== undefined) {
      child.stdin.write(opts.input)
    }
    child.stdin.end()

    child.stdout.on('data', (chunk: Buffer) => {
      void stream.write(chunk.toString())
    })
    child.stderr.on('data', (chunk: Buffer) => {
      void stream.write(chunk.toString())
    })
    child.on('error', (err: Error) => {
      if (opts.envName !== undefined) runningOps.delete(opts.envName)
      void stream.write(`\n✗ Failed to start ${command}: ${err.message}\n`)
      reject(err)
    })
    child.on('close', (code: number | null, signal: string | null) => {
      if (opts.envName !== undefined) runningOps.delete(opts.envName)
      if (signal !== null) {
        reject(new Error('Aborted'))
      } else if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

/** Spawn a Node script (seed/sync/wipe) via the shared command runner. */
function runScript(
  stream: StreamWriter,
  scriptPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  envName?: string,
): Promise<void> {
  return runCommand(stream, 'node', [scriptPath, ...args], env, {
    ...(envName !== undefined ? { envName } : {}),
  })
}

/**
 * Run a command to completion and capture its output, without streaming.
 * Used by the Vercel preflight (version/whoami checks). Never rejects — a
 * missing binary resolves with code null so the caller can report cleanly.
 */
function execCapture(
  command: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env: vercelEnv() })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
    child.on('error', (err: Error) => resolve({ code: null, stdout, stderr: stderr + err.message }))
    child.on('close', (code: number | null) => resolve({ code, stdout, stderr }))
  })
}

/**
 * Environment for spawned Vercel commands: inherit the operator's shell env
 * (so an ambient `vercel login` session and a globally-installed CLI are found)
 * and prepend the repo's node_modules/.bin in case vercel is a local dep.
 */
function vercelEnv(): NodeJS.ProcessEnv {
  const rootBin = path.join(REPO_ROOT, 'node_modules', '.bin')
  return { ...process.env, PATH: `${rootBin}:${process.env.PATH ?? ''}` }
}

/**
 * Resolve a Vercel bearer token without asking the operator for one:
 * explicit (form) → VERCEL_TOKEN env → the token the CLI stored at
 * `vercel login`. Returns null if none is found (caller fails loud).
 */
function resolveVercelToken(explicit?: string): string | null {
  if (explicit !== undefined && explicit.trim() !== '') return explicit.trim()
  if (process.env.VERCEL_TOKEN !== undefined && process.env.VERCEL_TOKEN !== '') {
    return process.env.VERCEL_TOKEN
  }
  const paths = cliAuthTokenPaths({
    home: homedir(),
    platform: process.platform,
    ...(process.env.XDG_DATA_HOME !== undefined ? { xdgDataHome: process.env.XDG_DATA_HOME } : {}),
    ...(process.env.XDG_CONFIG_HOME !== undefined
      ? { xdgConfigHome: process.env.XDG_CONFIG_HOME }
      : {}),
    ...(process.env.LOCALAPPDATA !== undefined ? { localAppData: process.env.LOCALAPPDATA } : {}),
  })
  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      const token = extractToken(readFileSync(p, 'utf-8'))
      if (token !== null) return token
    } catch {
      // Unreadable/!JSON — try the next candidate.
    }
  }
  return null
}

/**
 * Read the project id + team (org) id that `vercel link` wrote to
 * .vercel/project.json at the repo root, so the API call can target the
 * just-linked project.
 */
function readLinkedProject(): { projectId: string; orgId?: string } {
  const p = path.join(REPO_ROOT, '.vercel', 'project.json')
  const data = JSON.parse(readFileSync(p, 'utf-8')) as { projectId?: string; orgId?: string }
  if (data.projectId === undefined || data.projectId === '') {
    throw new Error('Linked project id not found in .vercel/project.json.')
  }
  return { projectId: data.projectId, ...(data.orgId ? { orgId: data.orgId } : {}) }
}

/**
 * Configure the freshly-linked project via the Vercel REST API — the settings
 * the CLI can't set. Sets the Root Directory (no CLI equivalent) and pins the
 * framework preset to Next.js: a `vercel link` leaves the preset as "Other",
 * and Vercel doesn't re-detect it on an existing project, so it must be set
 * explicitly for Vercel to wire up Next.js SSR/ISR/routing rather than treat
 * the output as static. Build/Output/Install/Dev commands stay unset (default).
 */
async function configureVercelProject(
  token: string,
  projectId: string,
  orgId: string | undefined,
  rootDirectory: string,
): Promise<void> {
  const url = new URL(`https://api.vercel.com/v9/projects/${projectId}`)
  if (orgId !== undefined) url.searchParams.set('teamId', orgId)
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rootDirectory, framework: 'nextjs' }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Vercel API could not configure project: HTTP ${res.status} ${detail}`.trim())
  }
}

// ── Operation config ─────────────────────────────────────────────────────────

const HUB_IMPORT_SCRIPT = path.join(HUB_MANAGEMENT_ROOT, 'scripts', 'hub-import.mjs')
const HUB_WIPE_SCRIPT = path.join(HUB_MANAGEMENT_ROOT, 'scripts', 'hub-wipe.mjs')

type OpConfig = { script: string; args: string[]; republish: boolean; label: string }

/**
 * Maps the URL :op segment to the underlying script + arguments.
 * "seed-*" variants force-republish everything (REPUBLISH=1).
 * "sync-*" variants publish only new/changed items.
 * "wipe-*" archives all content items and clears the import mapping.
 * Note: schemas and types don't have a distinct seed/sync command — both run
 * hub-import.mjs with the relevant step. The naming difference is cosmetic,
 * reflecting the user's intent (first run vs update).
 */
const OP_CONFIG: Record<string, OpConfig> = {
  'seed-settings': {
    script: HUB_IMPORT_SCRIPT,
    args: ['settings'],
    republish: false,
    label: 'Seed settings',
  },
  'sync-settings': {
    script: HUB_IMPORT_SCRIPT,
    args: ['settings'],
    republish: false,
    label: 'Sync settings',
  },
  'seed-schemas': {
    script: HUB_IMPORT_SCRIPT,
    args: ['schemas'],
    republish: false,
    label: 'Seed schemas',
  },
  'sync-schemas': {
    script: HUB_IMPORT_SCRIPT,
    args: ['schemas'],
    republish: false,
    label: 'Sync schemas',
  },
  'seed-types': {
    script: HUB_IMPORT_SCRIPT,
    args: ['types'],
    republish: false,
    label: 'Seed content types',
  },
  'sync-types': {
    script: HUB_IMPORT_SCRIPT,
    args: ['types'],
    republish: false,
    label: 'Sync content types',
  },
  'seed-extensions': {
    script: HUB_IMPORT_SCRIPT,
    args: ['extensions'],
    republish: false,
    label: 'Seed extensions',
  },
  'sync-extensions': {
    script: HUB_IMPORT_SCRIPT,
    args: ['extensions'],
    republish: false,
    label: 'Sync extensions',
  },
  // Webhooks are seeded through the Management API rather than dc-cli (dc-cli
  // strips secret headers), but they're the same script and the same step
  // vocabulary — seed and sync are one operation, as with schemas and types.
  'seed-webhooks': {
    script: HUB_IMPORT_SCRIPT,
    args: ['webhooks'],
    republish: false,
    label: 'Seed webhooks',
  },
  'sync-webhooks': {
    script: HUB_IMPORT_SCRIPT,
    args: ['webhooks'],
    republish: false,
    label: 'Sync webhooks',
  },
  'wipe-webhooks': {
    script: HUB_WIPE_SCRIPT,
    args: ['webhooks'],
    republish: false,
    label: 'Remove webhooks',
  },
  'seed-items': {
    script: HUB_IMPORT_SCRIPT,
    args: ['content'],
    republish: true,
    label: 'Seed content items',
  },
  'sync-items': {
    script: HUB_IMPORT_SCRIPT,
    args: ['content'],
    republish: false,
    label: 'Sync content items',
  },
  'wipe-items': {
    script: HUB_WIPE_SCRIPT,
    args: ['items'],
    republish: false,
    label: 'Wipe content items',
  },
  'seed-all': { script: HUB_IMPORT_SCRIPT, args: ['all'], republish: true, label: 'Seed all' },
  'sync-all': { script: HUB_IMPORT_SCRIPT, args: ['all'], republish: false, label: 'Sync all' },
  'wipe-all': { script: HUB_WIPE_SCRIPT, args: ['all'], republish: false, label: 'Wipe all' },
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5174' }))

// GET /api/environments
app.get('/api/environments', async (c) => {
  const config = await readConfig()
  return c.json(config)
})

// POST /api/environments  — add a new environment
app.post('/api/environments', async (c) => {
  const body = await c.req.json<Environment>()
  const config = await readConfig()

  if (config.environments.some((e) => e.name === body.name)) {
    return c.json({ error: `Environment "${body.name}" already exists.` }, 409)
  }

  config.environments.push(body)

  // Auto-activate if this is the first environment, and write env files so
  // the web app picks up the new hub immediately without a manual activate.
  if (config.environments.length === 1) {
    config.active = body.name
    await writeActiveEnvFiles(body, config.fixturesBrand ?? '')
  }

  await writeConfig(config)
  return c.json(config, 201)
})

// PUT /api/environments/:name  — update an existing environment
app.put('/api/environments/:name', async (c) => {
  const { name } = c.req.param()
  const body = await c.req.json<Environment>()
  const config = await readConfig()

  const idx = config.environments.findIndex((e) => e.name === name)
  if (idx === -1) {
    return c.json({ error: `Environment "${name}" not found.` }, 404)
  }

  if (name !== body.name && config.active === name) {
    config.active = body.name
  }

  config.environments[idx] = body
  await writeConfig(config)

  // If the updated environment is currently active, keep the env files in sync.
  if (config.active === body.name) {
    await writeActiveEnvFiles(body, config.fixturesBrand ?? '')
  }

  return c.json(config)
})

// PUT /api/fixtures  — update the built-in Local Fixtures source (brand only)
app.put('/api/fixtures', async (c) => {
  const body = await c.req.json<{ brand?: string }>()
  const config = await readConfig()

  config.fixturesBrand = (body.brand ?? '').trim()
  await writeConfig(config)

  // Only reaches the running app while fixtures are the active source.
  if (config.active === FIXTURES_NAME) {
    await writeActiveEnvFiles(null, config.fixturesBrand)
  }

  return c.json(config)
})

// PATCH /api/environments/:name/activate  — set as active + write apps/web/.env
app.patch('/api/environments/:name/activate', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()
  const isFixtures = name === FIXTURES_NAME

  if (!isFixtures && !config.environments.some((e) => e.name === name)) {
    return c.json({ error: `Environment "${name}" not found.` }, 404)
  }

  config.active = name
  await writeConfig(config)

  // Write connection vars to apps/web/.env so `pnpm dev` in apps/web
  // picks up the right hub without any manual .env editing.
  // Fixtures → clears the connection vars (web app falls back to fixture data)
  // and applies the fixtures brand.
  const env = isFixtures ? null : (config.environments.find((e) => e.name === name) ?? null)
  await writeActiveEnvFiles(env, config.fixturesBrand ?? '')

  return c.json(config)
})

// DELETE /api/environments/:name
app.delete('/api/environments/:name', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()

  const before = config.environments.length
  config.environments = config.environments.filter((e) => e.name !== name)

  if (config.environments.length === before) {
    return c.json({ error: `Environment "${name}" not found.` }, 404)
  }

  if (config.active === name) {
    config.active = config.environments[0]?.name ?? ''
  }

  await writeConfig(config)
  return c.json(config)
})

// POST /api/amplience/discover  — resolve hub + repos from a credential pair
app.post('/api/amplience/discover', async (c) => {
  const body = await c.req.json<{ clientId?: string; clientSecret?: string }>()
  const { clientId, clientSecret } = body
  if (!clientId || !clientSecret) {
    return c.json({ error: 'clientId and clientSecret are required' }, 400)
  }
  try {
    const hubs = await discoverHubs(clientId, clientSecret)
    return c.json({ hubs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: `Discovery failed: ${message}` }, 500)
  }
})

// ── Permissions ───────────────────────────────────────────────────────────────

// POST /api/amplience/permissions — preflight what a credential pair can read
// (live GET probes) and write (permission-filtered HAL links) across the
// resource areas the seed/sync/wipe operations touch. Takes credentials in
// the body (like /api/amplience/discover) so the settings modal can check
// form values that haven't been saved yet.
app.post('/api/amplience/permissions', async (c) => {
  const body = await c.req.json<{
    clientId?: string
    clientSecret?: string
    hubId?: string
    repoContent?: string
    repoSlots?: string
    repoSiteComponents?: string
  }>()
  const { clientId, clientSecret, hubId } = body
  if (!clientId || !clientSecret || !hubId) {
    return c.json({ error: 'clientId, clientSecret and hubId are required' }, 400)
  }

  try {
    const token = await getAmplienceToken(clientId, clientSecret)
    const fetchJson: FetchJson = async (url) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      let resBody: unknown = null
      try {
        resBody = await res.json()
      } catch {
        resBody = null
      }
      return { status: res.status, body: resBody }
    }
    const report = await buildPermissionsReport(
      {
        hubId,
        repoContent: body.repoContent ?? '',
        repoSlots: body.repoSlots ?? '',
        repoSiteComponents: body.repoSiteComponents ?? '',
      },
      fetchJson,
    )

    // DAM AssetStore read + write live in Content Hub (a separate GraphQL API)
    // but use the same token, so they're probed independently of DC hub
    // readability and appended to the same report. A failure here shouldn't
    // sink the whole preflight — record it as a check-level error instead.
    try {
      const damCheck = await buildDamCheck(liveGqlFetch(token))
      report.checks.push(damCheck)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      report.checks.push({
        key: 'dam',
        label: 'DAM AssetStore (media library)',
        read: 'error',
        write: 'error',
        detail: `probe failed: ${message}`,
      })
    }

    return c.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: `Permissions check failed: ${message}` }, 500)
  }
})

// ── Vercel provisioning (ADR-0017) ─────────────────────────────────────────────

// POST /api/vercel/preflight — is the Vercel CLI installed and logged in?
// Env-independent; drives whether the "Create Vercel site" action is offered
// and what guidance to show (install / `vercel login`).
app.post('/api/vercel/preflight', async (c) => {
  const version = await execCapture('vercel', ['--version'])
  if (version.code !== 0) {
    return c.json({
      cliInstalled: false,
      authenticated: false,
      detail: 'Vercel CLI not found. Install it with `npm i -g vercel`.',
    })
  }
  const who = await execCapture('vercel', ['whoami'])
  const authenticated = who.code === 0
  const user = authenticated ? who.stdout.trim() : ''
  return c.json({
    cliInstalled: true,
    authenticated,
    version: version.stdout.trim(),
    ...(user !== '' ? { user } : {}),
    ...(authenticated ? {} : { detail: 'Not logged in. Run `vercel login`.' }),
  })
})

// POST /api/environments/:name/vercel/create-site — provision a new Vercel
// project for this environment, push its runtime env vars, deploy, and record
// the resulting URL in webApps[]. Streams progress like the seed/sync ops and
// is cancellable via the existing DELETE …/cancel endpoint (registered under
// `name` in runningOps).
app.post('/api/environments/:name/vercel/create-site', async (c) => {
  const { name } = c.req.param()
  const body = await c.req.json<{
    brand?: string
    sitename?: string
    projectName?: string
    label?: string
    token?: string
    scope?: string
  }>()

  const config = await readConfig()
  const env = config.environments.find((e) => e.name === name)
  if (!env) return c.json({ error: `Environment "${name}" not found.` }, 404)
  if (env.hubName.trim() === '') {
    return c.json({ error: 'Environment has no hub name — set one before provisioning.' }, 400)
  }

  const site: VercelSiteInput = {
    brand: body.brand ?? '',
    sitename: body.sitename ?? '',
    ...(body.projectName !== undefined ? { projectName: body.projectName } : {}),
  }
  const projectName = deriveProjectName(env.name, site)
  const cliOpts = {
    ...(body.token ? { token: body.token } : {}),
    ...(body.scope ? { scope: body.scope } : {}),
  }
  const envVars = runtimeEnvVars(env, site)
  const cmdEnv = vercelEnv()

  return streamText(c, async (stream) => {
    await stream.writeln(`▶ Create Vercel site "${projectName}" — "${env.label || env.name}"…\n`)
    try {
      // 1. Preflight — fail loud before we create anything.
      const who = await execCapture('vercel', [
        'whoami',
        ...(cliOpts.token ? ['--token', cliOpts.token] : []),
      ])
      if (who.code !== 0) {
        throw new Error('Vercel CLI not authenticated — run `vercel login` (or pass a token).')
      }
      await stream.writeln(`• Authenticated as ${who.stdout.trim()}`)

      // 2. Ensure the project name is unique in this scope, so we create a fresh
      // project rather than silently adopting (and then overwriting) an existing
      // one. `vercel project ls` runs in the same scope the link will use, so no
      // separate team resolution is needed. On any failure we proceed with the
      // requested name (no worse than before).
      let targetName = projectName
      await stream.writeln('\n• Checking project-name availability…')
      let lastOut = ''
      try {
        // `vercel project ls` has no name filter, so page through all projects
        // in the scope (the same scope link uses) via the --next cursor.
        const taken: string[] = []
        let cursor: string | undefined
        for (let page = 0; page < 50; page++) {
          let pageOut = ''
          const listCapture: StreamWriter = {
            write: (t: string) => {
              pageOut += t
              return Promise.resolve(undefined)
            },
          }
          await runCommand(listCapture, 'vercel', projectListArgs(cliOpts, cursor), cmdEnv, {
            cwd: REPO_ROOT,
          })
          lastOut = pageOut
          taken.push(...parseProjectNames(pageOut))
          const next = parseNextCursor(pageOut)
          if (next === null) break
          cursor = next
        }
        targetName = nextAvailableName(projectName, taken)
        await stream.writeln(
          targetName === projectName
            ? `  "${projectName}" is available.`
            : `  "${projectName}" already exists — using "${targetName}".`,
        )
      } catch (err) {
        // Surface WHY the list failed (bad flag, auth, scope…) so it's
        // debuggable rather than silently degrading to a possible overwrite.
        const msg = err instanceof Error ? err.message : String(err)
        const detail = stripAnsi(lastOut)
          .trim()
          .split('\n')
          .filter(Boolean)
          .slice(-4)
          .join('\n    ')
        await stream.writeln(`  ⚠ Could not list existing projects (${msg}).`)
        if (detail !== '') await stream.writeln(`    ${detail}`)
        await stream.writeln('    Proceeding with the requested name.')
      }

      // 3. Link/create the project under the operator's scope. The CLI handles
      // auth + team resolution and writes .vercel/project.json. Run from the
      // repo root so the deploy below uploads the whole workspace.
      await stream.writeln(`\n• Linking project "${targetName}"…`)
      await runCommand(stream, 'vercel', linkArgs(targetName, cliOpts), cmdEnv, {
        cwd: REPO_ROOT,
        envName: name,
      })

      // 4. Configure the project via the API — the settings the CLI can't set:
      // Root Directory = apps/web (a CLI link records "./", breaking Next.js
      // detection) and framework = Next.js (a link leaves it "Other"). Reuses
      // the CLI's own login token, so nothing extra is asked for.
      const token = resolveVercelToken(body.token)
      if (token === null) {
        throw new Error(
          'No Vercel token found — run `vercel login` (or set VERCEL_TOKEN) so the root directory can be set.',
        )
      }
      const { projectId, orgId } = readLinkedProject()
      await stream.writeln('• Setting Root Directory to "apps/web" and framework to Next.js…')
      await configureVercelProject(token, projectId, orgId, 'apps/web')

      // 5. Push the runtime env vars (values via stdin, not argv). Remove first
      // so a re-run overwrites cleanly rather than erroring on an existing var.
      await stream.writeln(`\n• Pushing ${String(envVars.length)} runtime variable(s)…`)
      const discard: StreamWriter = { write: () => Promise.resolve(undefined) }
      for (const v of envVars) {
        for (const target of v.targets) {
          await stream.writeln(`  – ${v.key} → ${target}`)
          await runCommand(discard, 'vercel', envRmArgs(v.key, target, cliOpts), cmdEnv, {
            cwd: REPO_ROOT,
          }).catch(() => {
            // No existing value to remove — expected on a first run.
          })
          // Value via stdin with NO trailing newline — `vercel env add` stores
          // stdin verbatim, so a newline would be baked into the value (and
          // e.g. fail SITE_NAME validation). Close stdin (in runCommand) is
          // what signals end-of-value.
          await runCommand(stream, 'vercel', envAddArgs(v.key, target, cliOpts), cmdEnv, {
            cwd: REPO_ROOT,
            envName: name,
            input: v.value,
          })
        }
      }

      // 6. Deploy to production from the repo root (so the pnpm workspace is
      // present); Vercel builds apps/web via the Root Directory set in step 4.
      await stream.writeln('\n• Deploying to production…')
      let deployOut = ''
      const capture: StreamWriter = {
        write: (t: string) => {
          deployOut += t
          return stream.write(t)
        },
      }
      await runCommand(capture, 'vercel', deployArgs(cliOpts), cmdEnv, {
        cwd: REPO_ROOT,
        envName: name,
      })

      // 7. Record the deployed site in webApps[] — same shape the manual
      //    "Add existing site" form writes, so the two paths converge.
      const url = parseDeploymentUrl(deployOut)
      if (url === null) {
        await stream.writeln(
          '\n⚠ Deploy finished but no URL was found in the output — add the site manually once you have its URL.',
        )
      } else {
        const fresh = await readConfig()
        const target = fresh.environments.find((e) => e.name === name)
        if (target !== undefined) {
          target.webApps.push({
            label: (body.label ?? '').trim(),
            url,
            brand: site.brand.trim() || env.defaultBrand,
            name: site.sitename.trim() || env.defaultSite,
            vercelProjectName: targetName,
            ...(cliOpts.scope ? { vercelScope: cliOpts.scope } : {}),
          })
          await writeConfig(fresh)
          await stream.writeln(`\n✓ Recorded site: ${url}`)
        }
      }

      await stream.writeln('\n✓ Done.')
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'Aborted'
          ? 'Aborted by user.'
          : err instanceof Error
            ? err.message
            : String(err)
      await stream.writeln(`\n✗ ${msg}`)
    }
  })
})

// POST /api/environments/:name/vercel/redeploy-site — re-point a provisioned
// site to a different hub ("content source") and redeploy it. A deployment's
// hub is fixed at build time by its env vars (AMPLIENCE_HUB_NAME etc.), so
// switching hubs means: rewrite those vars to the target hub's values, then run
// a fresh prod deploy. On success the site row is moved from the source hub's
// webApps[] to the target's (carrying any edited label/brand/name and the new
// deployment URL). Only sites with a tracked vercelProjectName can be
// redeployed — manual sites have no project to build, so this refuses them.
// Streams progress like create-site and is cancellable via …/cancel (keyed on
// the source `name`).
app.post('/api/environments/:name/vercel/redeploy-site', async (c) => {
  const { name } = c.req.param()
  const body = await c.req.json<{
    index?: number
    targetName?: string
    label?: string
    brand?: string
    sitename?: string
    token?: string
    scope?: string
  }>()

  const index = body.index
  if (index === undefined) return c.json({ error: 'Missing site index.' }, 400)
  const targetName = body.targetName
  if (targetName === undefined || targetName === '') {
    return c.json({ error: 'Missing target hub name.' }, 400)
  }

  const config = await readConfig()
  const sourceEnv = config.environments.find((e) => e.name === name)
  if (!sourceEnv) return c.json({ error: `Environment "${name}" not found.` }, 404)
  const site = sourceEnv.webApps[index]
  if (!site) return c.json({ error: 'Site not found at that index.' }, 404)
  if (site.vercelProjectName === undefined || site.vercelProjectName === '') {
    return c.json(
      {
        error:
          'This site has no tracked Vercel project — it was added manually, not provisioned by Quadratic Lite. Move it without a redeploy instead.',
      },
      400,
    )
  }
  const targetEnv = config.environments.find((e) => e.name === targetName)
  if (!targetEnv) return c.json({ error: `Target hub "${targetName}" not found.` }, 404)
  if (targetEnv.hubName.trim() === '') {
    return c.json({ error: 'Target hub has no hub name — set one before redeploying.' }, 400)
  }

  const projectName = site.vercelProjectName
  const cliOpts = {
    ...(body.token ? { token: body.token } : {}),
    ...((body.scope ?? site.vercelScope) ? { scope: body.scope ?? site.vercelScope } : {}),
  }
  const siteInput: VercelSiteInput = {
    brand: body.brand ?? site.brand,
    sitename: body.sitename ?? site.name,
  }
  // Env vars computed against the TARGET hub — this is what re-points the build.
  const envVars = runtimeEnvVars(targetEnv, siteInput)
  // Reset every hub-determining key first (both runtime targets), so a var that
  // no longer applies after the move (e.g. a SITE_NAME that now equals the hub
  // name, or a brand that reverted to default) doesn't linger from the old hub.
  const KNOWN_KEYS = [
    'AMPLIENCE_HUB_NAME',
    'SITE_NAME',
    'NEXT_PUBLIC_BRAND',
    'AMPLIENCE_CUSTOM_CSS',
  ]
  const RESET_TARGETS = ['production', 'preview'] as const
  const cmdEnv = vercelEnv()

  return streamText(c, async (stream) => {
    const siteName = site.label || projectName
    await stream.writeln(
      name === targetName
        ? `▶ Updating "${siteName}" and redeploying…\n`
        : `▶ Re-pointing "${siteName}" to "${targetEnv.label || targetEnv.name}" and redeploying…\n`,
    )
    try {
      // 1. Preflight.
      const who = await execCapture('vercel', [
        'whoami',
        ...(cliOpts.token ? ['--token', cliOpts.token] : []),
      ])
      if (who.code !== 0) {
        throw new Error('Vercel CLI not authenticated — run `vercel login` (or pass a token).')
      }
      await stream.writeln(`• Authenticated as ${who.stdout.trim()}`)

      // 2. Link the existing project so env/deploy target it (writes
      //    .vercel/project.json). The project already exists, so this just
      //    associates the working dir — root dir/framework stay as configured.
      await stream.writeln(`\n• Linking project "${projectName}"…`)
      await runCommand(stream, 'vercel', linkArgs(projectName, cliOpts), cmdEnv, {
        cwd: REPO_ROOT,
        envName: name,
      })

      // 3. Reset the known hub env vars, then push the target hub's values.
      //    Removing a key that no longer applies (e.g. a now-blank brand) is how
      //    a field is "cleared" — the app falls back to its own default rather
      //    than reading an empty value. rm output is discarded (a "not found" is
      //    expected and noisy), but each key is announced so the step isn't a
      //    silent gap.
      await stream.writeln('\n• Resetting hub environment variables…')
      const discard: StreamWriter = { write: () => Promise.resolve(undefined) }
      for (const key of KNOWN_KEYS) {
        await stream.writeln(`  – clearing ${key}`)
        for (const target of RESET_TARGETS) {
          await runCommand(discard, 'vercel', envRmArgs(key, target, cliOpts), cmdEnv, {
            cwd: REPO_ROOT,
          }).catch(() => {
            // Nothing to remove — expected for keys the old hub didn't set.
          })
        }
      }
      await stream.writeln(`• Pushing ${String(envVars.length)} runtime variable(s)…`)
      for (const v of envVars) {
        for (const target of v.targets) {
          await stream.writeln(`  – ${v.key} → ${target}`)
          // Value via stdin (no trailing newline) so it never lands in argv.
          await runCommand(stream, 'vercel', envAddArgs(v.key, target, cliOpts), cmdEnv, {
            cwd: REPO_ROOT,
            envName: name,
            input: v.value,
          })
        }
      }

      // 4. Deploy to production from the repo root.
      await stream.writeln('\n• Deploying to production…')
      let deployOut = ''
      const capture: StreamWriter = {
        write: (t: string) => {
          deployOut += t
          return stream.write(t)
        },
      }
      await runCommand(capture, 'vercel', deployArgs(cliOpts), cmdEnv, {
        cwd: REPO_ROOT,
        envName: name,
      })
      const url = parseDeploymentUrl(deployOut)

      // 5. Write the updated site back to the config, carrying the edited
      //    fields and the (possibly new) deployment URL. Re-read first so a
      //    concurrent edit isn't clobbered; guard the index. A same-hub edit
      //    (brand/site-name change, no move) replaces in place; a hub change
      //    removes from the source and appends to the target.
      const fresh = await readConfig()
      const freshSource = fresh.environments.find((e) => e.name === name)
      const freshTarget = fresh.environments.find((e) => e.name === targetName)
      if (freshSource === undefined || freshTarget === undefined) {
        throw new Error('Config changed during redeploy — source or target hub is gone.')
      }
      const moved: WebApp = {
        label: (body.label ?? site.label).trim(),
        url: url ?? site.url,
        brand: siteInput.brand.trim() || targetEnv.defaultBrand,
        name: siteInput.sitename.trim() || targetEnv.defaultSite,
        vercelProjectName: projectName,
        ...(site.vercelScope ? { vercelScope: site.vercelScope } : {}),
      }
      if (name === targetName) {
        if (freshSource.webApps[index] === undefined) {
          throw new Error('Config changed during redeploy — site index no longer exists.')
        }
        freshSource.webApps[index] = moved
      } else {
        freshSource.webApps = freshSource.webApps.filter((_, i) => i !== index)
        freshTarget.webApps.push(moved)
      }
      await writeConfig(fresh)

      if (url === null) {
        await stream.writeln(
          '\n⚠ Deploy finished but no URL was found in the output — the site was moved; verify its URL in the config.',
        )
      } else {
        await stream.writeln(`\n✓ Redeployed and re-pointed: ${url}`)
      }
      await stream.writeln('\n✓ Done.')
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'Aborted'
          ? 'Aborted by user.'
          : err instanceof Error
            ? err.message
            : String(err)
      await stream.writeln(`\n✗ ${msg}`)
    }
  })
})

// POST /api/environments/:name/vercel/destroy-site — delete the Vercel project
// behind a webApps[] entry, then drop it from the config. Only sites created
// via "Create Vercel site" carry a vercelProjectName; sites added manually via
// "Add existing site" were never ours to provision, so this route refuses
// them (400) rather than guessing at a project to delete — the caller should
// remove those from the config directly instead (PUT /environments/:name).
app.post('/api/environments/:name/vercel/destroy-site', async (c) => {
  const { name } = c.req.param()
  const body = await c.req.json<{ index?: number; token?: string; scope?: string }>()
  const index = body.index
  if (index === undefined) return c.json({ error: 'Missing site index.' }, 400)

  const config = await readConfig()
  const env = config.environments.find((e) => e.name === name)
  if (!env) return c.json({ error: `Environment "${name}" not found.` }, 404)
  const site = env.webApps[index]
  if (!site) return c.json({ error: 'Site not found at that index.' }, 404)
  if (site.vercelProjectName === undefined || site.vercelProjectName === '') {
    return c.json(
      {
        error:
          'This site has no tracked Vercel project — it was added manually, not provisioned by Quadratic Lite. Remove it from the config instead.',
      },
      400,
    )
  }

  const projectName = site.vercelProjectName
  const scope = body.scope ?? site.vercelScope

  return streamText(c, async (stream) => {
    try {
      await stream.writeln(`▶ Destroying Vercel project "${projectName}"…`)
      const token = resolveVercelToken(body.token)
      if (token === null) {
        throw new Error(
          'No Vercel token found — run `vercel login` (or set VERCEL_TOKEN) so the project can be deleted.',
        )
      }

      const url = new URL(`https://api.vercel.com/v9/projects/${projectName}`)
      if (scope !== undefined && scope !== '') url.searchParams.set('teamId', scope)
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        await stream.writeln('✓ Vercel project deleted.')
      } else if (res.status === 404) {
        // Already gone (e.g. deleted manually in the Vercel dashboard) —
        // treat as success so the config entry can still be cleaned up.
        await stream.writeln('• Project already gone on Vercel — continuing.')
      } else {
        const detail = await res.text().catch(() => '')
        throw new Error(`Vercel API could not delete project: HTTP ${res.status} ${detail}`.trim())
      }

      // Re-read in case the config changed since the request started, then
      // drop this site by index.
      const fresh = await readConfig()
      const target = fresh.environments.find((e) => e.name === name)
      if (target !== undefined) {
        target.webApps = target.webApps.filter((_, i) => i !== index)
        await writeConfig(fresh)
      }
      await stream.writeln('\n✓ Removed from config.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await stream.writeln(`\n✗ ${msg}`)
    }
  })
})

// ── Stats ─────────────────────────────────────────────────────────────────────

// GET /api/environments/:name/stats  — fetch resource counts from Amplience API
app.get('/api/environments/:name/stats', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()
  const env = config.environments.find((e) => e.name === name)
  if (!env) return c.json({ error: `Environment "${name}" not found.` }, 404)

  if (!env.clientId || !env.clientSecret || !env.hubId || !env.repoContent || !env.repoSlots) {
    return c.json(
      {
        error:
          'Environment is missing credentials — clientId, clientSecret, hubId, repoContent and repoSlots are all required.',
      },
      400,
    )
  }

  try {
    const token = await getAmplienceToken(env.clientId, env.clientSecret)
    // Ordered as the GUI lists them: settings → schemas → types → extensions
    // → webhooks → content items.
    const [workflowStates, schemas, types, extensions, webhooks, contentItems, slotItems] =
      await Promise.all([
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/workflow-states`),
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/content-type-schemas?status=ACTIVE`),
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/content-types?status=ACTIVE`),
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/extensions`),
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/webhooks`),
        fetchCount(
          token,
          `${AMPLIENCE_API}/content-repositories/${env.repoContent}/content-items?status=ACTIVE`,
        ),
        fetchCount(
          token,
          `${AMPLIENCE_API}/content-repositories/${env.repoSlots}/content-items?status=ACTIVE`,
        ),
      ])
    return c.json({
      workflowStates,
      schemas,
      types,
      extensions,
      webhooks,
      items: contentItems + slotItems,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Failed to fetch stats for environment!! "${env.name}":`, err)
    return c.json({ error: `Stats fetch failed: ${message}` }, 500)
  }
})

// ── Operations (streaming) ────────────────────────────────────────────────────
//
// POST /api/environments/:name/:op
//
// :op must be a key in OP_CONFIG — see the table above for the full list.
// All operations stream their output as plain text.

app.post('/api/environments/:name/:op', async (c) => {
  const { name, op } = c.req.param()
  const opCfg = OP_CONFIG[op]
  if (opCfg === undefined) return c.json({ error: `Unknown operation "${op}".` }, 400)

  const config = await readConfig()
  const env = config.environments.find((e) => e.name === name)
  if (!env) return c.json({ error: `Environment "${name}" not found.` }, 404)

  return streamText(c, async (stream) => {
    await stream.writeln(`▶ ${opCfg.label} — "${env.label || env.name}"…\n`)
    try {
      await runScript(stream, opCfg.script, opCfg.args, buildEnv(env, opCfg.republish), name)
      await stream.writeln('\n✓ Done.')
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'Aborted'
          ? 'Aborted by user.'
          : err instanceof Error
            ? err.message
            : String(err)
      await stream.writeln(`\n✗ ${msg}`)
    }
  })
})

// DELETE /api/environments/:name/cancel  — kill the running operation for this environment
app.delete('/api/environments/:name/cancel', (c) => {
  const { name } = c.req.param()
  const child = runningOps.get(name)
  console.log(
    `[cancel] name="${name}" keys=[${[...runningOps.keys()].join(', ')}] found=${child !== undefined}`,
  )
  if (child === undefined) return c.json({ error: 'No running operation.' }, 404)
  // Kill the entire process group (negative PID) with SIGKILL so dc-cli grandchildren
  // are also terminated immediately and cannot be ignored by a hung process.
  const pid = child.pid
  console.log(`[cancel] pid=${String(pid)} sending SIGKILL to process group -${String(pid)}`)
  if (pid !== undefined) {
    try {
      process.kill(-pid, 'SIGKILL')
      console.log(`[cancel] process.kill(-${pid}, SIGKILL) succeeded`)
    } catch (err) {
      console.log(
        `[cancel] process.kill failed (${String(err)}), falling back to child.kill('SIGKILL')`,
      )
      child.kill('SIGKILL')
    }
  } else {
    console.log(`[cancel] pid undefined, falling back to child.kill('SIGKILL')`)
    child.kill('SIGKILL')
  }
  return c.json({ ok: true })
})

// ── Start ─────────────────────────────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`  ➜  API server running at http://localhost:${PORT}`)
  console.log(
    `  ➜  Config: ${existsSync(CONFIG_PATH) ? CONFIG_PATH : `${CONFIG_PATH} (not yet created — starting blank)`}`,
  )
})
