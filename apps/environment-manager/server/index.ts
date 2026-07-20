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

import { buildPermissionsReport, type FetchJson } from './permissions.ts'
import {
  cliAuthTokenPaths,
  deployArgs,
  deriveProjectName,
  envAddArgs,
  envRmArgs,
  extractToken,
  linkArgs,
  parseDeploymentUrl,
  runtimeEnvVars,
  type VercelSiteInput,
} from './vercel.ts'

// ── Paths ─────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// apps/environment-manager/server/ → 3 levels up → repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const HUB_MANAGEMENT_ROOT = path.join(REPO_ROOT, 'packages', 'hub-management')
const CONFIG_PATH = path.join(REPO_ROOT, 'quadratic.config.json')
const WEB_APP_ROOT = path.join(REPO_ROOT, 'apps', 'web')
const WEB_ENV_LOCAL = path.join(WEB_APP_ROOT, '.env.local')
const HUB_MANAGEMENT_ENV = path.join(HUB_MANAGEMENT_ROOT, '.env')
const PORT = 3099

/** Sentinel name for the built-in "Local Fixtures" entry — never stored in config.json. */
const FIXTURES_NAME = 'fixtures'

// ── Types ─────────────────────────────────────────────────────────────────────

// `name` is the delivery-key namespace (SITE_NAME, ADR-0014); matches the
// field the UI reads/writes and what's stored in quadratic.config.json.
type WebApp = { label: string; url: string; brand: string; name: string }

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
}

// ── Config helpers ────────────────────────────────────────────────────────────

async function readConfig(): Promise<Config> {
  if (!existsSync(CONFIG_PATH)) {
    return { active: FIXTURES_NAME, environments: [] }
  }
  const raw = await readFile(CONFIG_PATH, 'utf-8')
  return JSON.parse(raw) as Config
}

async function writeConfig(config: Config): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

// ── .env.local writer ─────────────────────────────────────────────────────────

/**
 * Additive update of specific keys in a .env-format string.
 * - Keys already present (active or commented) are updated in place.
 * - Keys not present are appended if they have a value; skipped otherwise.
 * - An undefined/empty value comments the key out (preserves its presence for
 *   readability) rather than removing the line entirely.
 */
function updateEnvVars(content: string, vars: Record<string, string | undefined>): string {
  const lines = content.length > 0 ? content.split('\n') : []
  const handled = new Set<string>()

  const result = lines.map((line) => {
    // Strip any leading comment marker to find the key
    const bare = line.replace(/^#\s*/, '')
    for (const [key, value] of Object.entries(vars)) {
      if (bare.startsWith(`${key}=`) || bare.startsWith(`${key} =`)) {
        handled.add(key)
        return value ? `${key}="${value}"` : `# ${key}=`
      }
    }
    return line
  })

  // Append keys that weren't already in the file
  for (const [key, value] of Object.entries(vars)) {
    if (!handled.has(key) && value) {
      result.push(`${key}="${value}"`)
    }
  }

  const joined = result.join('\n')
  if (joined.length === 0) return ''
  return joined.endsWith('\n') ? joined : `${joined}\n`
}

/**
 * Write Amplience connection vars to apps/web/.env.local AND packages/hub-management/.env
 * so that both the web app and the CLI scripts (`pnpm hub:import` etc.) stay in sync
 * with the active environment.
 * Pass null (for Fixtures) to comment Amplience vars out; the web app falls back to
 * bundled fixture data and CLI commands will have no hub to target.
 */
async function writeActiveEnvFiles(env: Environment | null): Promise<void> {
  // Treat blank strings as no-value so we never write KEY="" to env files.
  const hubName = env !== null && env.hubName !== '' ? env.hubName : undefined
  const stagingHost = env !== null && env.stagingHost !== '' ? env.stagingHost : undefined
  const clientId = env !== null && env.clientId !== '' ? env.clientId : undefined
  const clientSecret = env !== null && env.clientSecret !== '' ? env.clientSecret : undefined
  const hubId = env !== null && env.hubId !== '' ? env.hubId : undefined
  const localhostUrl = env !== null && env.localhostUrl !== '' ? env.localhostUrl : undefined
  const repoContent = env !== null && env.repoContent !== '' ? env.repoContent : undefined
  const repoSlots = env !== null && env.repoSlots !== '' ? env.repoSlots : undefined
  const repoSiteComponents =
    env !== null && (env.repoSiteComponents ?? '') !== '' ? env.repoSiteComponents : undefined
  const defaultBrand = env !== null && env.defaultBrand !== '' ? env.defaultBrand : undefined
  // Blank default site means "use the runtime default" (the hub name, ADR-0014)
  // — comment the var out rather than writing an empty value.
  const defaultSite = env !== null && (env.defaultSite ?? '') !== '' ? env.defaultSite : undefined

  // apps/web/.env.local — only the vars the web app needs
  const existingWeb = existsSync(WEB_ENV_LOCAL) ? await readFile(WEB_ENV_LOCAL, 'utf-8') : ''
  await writeFile(
    WEB_ENV_LOCAL,
    updateEnvVars(existingWeb, {
      AMPLIENCE_HUB_NAME: hubName,
      AMPLIENCE_STAGING_HOST: stagingHost,
      NEXT_PUBLIC_BRAND: defaultBrand,
      SITE_NAME: defaultSite,
    }),
    'utf-8',
  )

  // packages/hub-management/.env — full set of vars consumed by hub:import / hub:wipe scripts
  const existingHubEnv = existsSync(HUB_MANAGEMENT_ENV)
    ? await readFile(HUB_MANAGEMENT_ENV, 'utf-8')
    : ''
  await writeFile(
    HUB_MANAGEMENT_ENV,
    updateEnvVars(existingHubEnv, {
      AMPLIENCE_HUB_NAME: hubName,
      AMPLIENCE_HUB_ID: hubId,
      LOCALHOST_URL: localhostUrl,
      AMPLIENCE_REPO_CONTENT: repoContent,
      AMPLIENCE_REPO_SLOTS: repoSlots,
      AMPLIENCE_REPO_SITE_COMPONENTS: repoSiteComponents,
      AMPLIENCE_CLIENT_ID: clientId,
      AMPLIENCE_CLIENT_SECRET: clientSecret,
      AMPLIENCE_STAGING_HOST: stagingHost,
      SITE_NAME: defaultSite,
    }),
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

    if (opts.input !== undefined) {
      child.stdin.write(opts.input)
      child.stdin.end()
    }

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
    await writeActiveEnvFiles(body)
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
    await writeActiveEnvFiles(body)
  }

  return c.json(config)
})

// PATCH /api/environments/:name/activate  — set as active + write apps/web/.env.local
app.patch('/api/environments/:name/activate', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()
  const isFixtures = name === FIXTURES_NAME

  if (!isFixtures && !config.environments.some((e) => e.name === name)) {
    return c.json({ error: `Environment "${name}" not found.` }, 404)
  }

  config.active = name
  await writeConfig(config)

  // Write connection vars to apps/web/.env.local so `pnpm dev` in apps/web
  // picks up the right hub without any manual .env editing.
  // Fixtures → clears both vars (web app falls back to fixture data).
  const env = isFixtures ? null : (config.environments.find((e) => e.name === name) ?? null)
  await writeActiveEnvFiles(env)

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

      // 2. Link/create the project under the operator's scope. The CLI handles
      // auth + team resolution and writes .vercel/project.json. Run from the
      // repo root so the deploy below uploads the whole workspace.
      await stream.writeln(`\n• Linking project "${projectName}"…`)
      await runCommand(stream, 'vercel', linkArgs(projectName, cliOpts), cmdEnv, {
        cwd: REPO_ROOT,
        envName: name,
      })

      // 3. Configure the project via the API — the settings the CLI can't set:
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

      // 4. Push the runtime env vars (values via stdin, not argv). Remove first
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

      // 5. Deploy to production from the repo root (so the pnpm workspace is
      // present); Vercel builds apps/web via the Root Directory set in step 3.
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

      // 6. Record the deployed site in webApps[] — same shape the manual
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
    const [schemas, types, contentItems, slotItems, extensions, workflowStates] = await Promise.all(
      [
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/content-type-schemas?status=ACTIVE`),
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/content-types?status=ACTIVE`),
        fetchCount(
          token,
          `${AMPLIENCE_API}/content-repositories/${env.repoContent}/content-items?status=ACTIVE`,
        ),
        fetchCount(
          token,
          `${AMPLIENCE_API}/content-repositories/${env.repoSlots}/content-items?status=ACTIVE`,
        ),
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/extensions`),
        fetchCount(token, `${AMPLIENCE_API}/hubs/${env.hubId}/workflow-states`),
      ],
    )
    return c.json({ schemas, types, items: contentItems + slotItems, extensions, workflowStates })
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
