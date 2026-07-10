import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamText } from 'hono/streaming'

// ── Paths ─────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// apps/environment-manager/server/ → 3 levels up → repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const HUB_MANAGEMENT_ROOT = path.join(REPO_ROOT, 'packages', 'hub-management')
const CONFIG_PATH = path.join(REPO_ROOT, 'quadratic.config.json')
const WEB_ENV_LOCAL = path.join(REPO_ROOT, 'apps', 'web', '.env.local')
const HUB_MANAGEMENT_ENV = path.join(HUB_MANAGEMENT_ROOT, '.env')
const PORT = 3099

/** Sentinel name for the built-in "Local Fixtures" entry — never stored in config.json. */
const FIXTURES_NAME = 'fixtures'

// ── Types ─────────────────────────────────────────────────────────────────────

type WebApp = { label: string; url: string; brand: string; sitename: string }

type Environment = {
  name: string
  label: string
  hubName: string
  hubId: string
  localhostUrl: string
  repoContent: string
  repoSlots: string
  clientId: string
  clientSecret: string
  stagingHost: string
  defaultBrand: string
  /** SITE_NAME for the hub's main frontend (ADR-0014); blank = hub-name default. */
  defaultSite: string
  webApps: WebApp[]
  republish: boolean
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
    AMPLIENCE_CLIENT_ID: env.clientId,
    AMPLIENCE_CLIENT_SECRET: env.clientSecret,
    AMPLIENCE_HUB_ID: env.hubId,
    AMPLIENCE_REPUBLISH: republish || env.republish ? '1' : '',
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
 * Spawn a Node script, piping stdout + stderr into the Hono stream.
 * Resolves on clean exit, rejects on non-zero exit or signal kill.
 * The optional `envName` is used to register the child in `runningOps`
 * so the cancel endpoint can kill it.
 */
function runScript(
  stream: StreamWriter,
  scriptPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  envName?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // detached: true puts the child in its own process group so that a
    // cancel can send SIGKILL to the whole group (node + any dc-cli grandchild).
    const child = spawn('node', [scriptPath, ...args], {
      cwd: HUB_MANAGEMENT_ROOT,
      env,
      detached: true,
    })

    if (envName !== undefined) {
      runningOps.set(envName, child)
      console.log(`[runScript] registered pid=${String(child.pid)} for env="${envName}"`)
    }

    child.stdout.on('data', (chunk: Buffer) => {
      void stream.write(chunk.toString())
    })
    child.stderr.on('data', (chunk: Buffer) => {
      void stream.write(chunk.toString())
    })
    child.on('error', (err: Error) => {
      if (envName !== undefined) runningOps.delete(envName)
      void stream.write(`\n✗ Failed to start process: ${err.message}\n`)
      reject(err)
    })
    child.on('close', (code: number | null, signal: string | null) => {
      if (envName !== undefined) runningOps.delete(envName)
      if (signal !== null) {
        reject(new Error('Aborted'))
      } else if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Process exited with code ${code ?? 'unknown'}`))
      }
    })
  })
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
    args: [],
    republish: false,
    label: 'Wipe content items',
  },
  'seed-all': { script: HUB_IMPORT_SCRIPT, args: ['all'], republish: true, label: 'Seed all' },
  'sync-all': { script: HUB_IMPORT_SCRIPT, args: ['all'], republish: false, label: 'Sync all' },
  'wipe-all': { script: HUB_WIPE_SCRIPT, args: [], republish: false, label: 'Wipe all' },
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
