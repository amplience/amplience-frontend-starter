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
const SCHEMAS_ROOT = path.join(REPO_ROOT, 'packages', 'schemas')
const CONFIG_PATH = path.join(REPO_ROOT, 'quadratic.config.json')
const EXAMPLE_PATH = path.join(REPO_ROOT, 'quadratic.config.example.json')
const WEB_ENV_LOCAL = path.join(REPO_ROOT, 'apps', 'web', '.env.local')
const PORT = 3099

/** Sentinel name for the built-in "Local Fixtures" entry — never stored in config.json. */
const FIXTURES_NAME = 'fixtures'

// ── Types ─────────────────────────────────────────────────────────────────────

type Environment = {
  name: string
  label: string
  hubName: string
  hubId: string
  appUrl: string
  repoContent: string
  repoSlots: string
  clientId: string
  clientSecret: string
  stagingHost: string
  republish: boolean
}

type Config = {
  active: string
  environments: Environment[]
}

// ── Config helpers ────────────────────────────────────────────────────────────

async function readConfig(): Promise<Config> {
  const filePath = existsSync(CONFIG_PATH) ? CONFIG_PATH : EXAMPLE_PATH
  const raw = await readFile(filePath, 'utf-8')
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
 * Write Amplience connection vars to apps/web/.env.local.
 * Pass null (for Fixtures) to comment both keys out so the web app
 * falls back to its bundled fixture data.
 */
async function writeWebEnvLocal(env: Environment | null): Promise<void> {
  const existing = existsSync(WEB_ENV_LOCAL) ? await readFile(WEB_ENV_LOCAL, 'utf-8') : ''
  // Treat blank strings as no-value so we never write `KEY=""` to .env.local.
  const hubName = env !== null && env.hubName !== '' ? env.hubName : undefined
  const stagingHost = env !== null && env.stagingHost !== '' ? env.stagingHost : undefined
  const updated = updateEnvVars(existing, {
    AMPLIENCE_HUB_NAME: hubName,
    AMPLIENCE_STAGING_HOST: stagingHost,
  })
  await writeFile(WEB_ENV_LOCAL, updated, 'utf-8')
}

// ── Script runner ─────────────────────────────────────────────────────────────

/**
 * Build the env vars to inject into a spawned script.
 * Spreads process.env so PATH, HOME, etc. are inherited, then layers the
 * selected environment's Amplience credentials on top.
 * dc-cli is a devDependency of packages/schemas — prepend its bin dir to PATH
 * so node_modules/.bin/dc-cli is found when running scripts directly.
 */
function buildEnv(env: Environment, republish = false): NodeJS.ProcessEnv {
  const dcCliBin = path.join(SCHEMAS_ROOT, 'node_modules', '.bin')
  const rootBin = path.join(REPO_ROOT, 'node_modules', '.bin')
  return {
    ...process.env,
    PATH: `${dcCliBin}:${rootBin}:${process.env.PATH ?? ''}`,
    AMPLIENCE_HUB_NAME: env.hubName,
    AMPLIENCE_APP_URL: env.appUrl,
    AMPLIENCE_REPO_CONTENT: env.repoContent,
    AMPLIENCE_REPO_SLOTS: env.repoSlots,
    AMPLIENCE_CLIENT_ID: env.clientId,
    AMPLIENCE_CLIENT_SECRET: env.clientSecret,
    AMPLIENCE_HUB_ID: env.hubId,
    AMPLIENCE_REPUBLISH: republish || env.republish ? '1' : '',
  }
}

type StreamWriter = { write: (text: string) => Promise<void> }

/**
 * Spawn a Node script, piping stdout + stderr into the Hono stream.
 * Resolves on exit 0, rejects with the exit code on failure.
 */
function runScript(
  stream: StreamWriter,
  scriptPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      cwd: SCHEMAS_ROOT,
      env,
    })

    child.stdout.on('data', (chunk: Buffer) => {
      void stream.write(chunk.toString())
    })
    child.stderr.on('data', (chunk: Buffer) => {
      void stream.write(chunk.toString())
    })
    child.on('error', (err: Error) => {
      void stream.write(`\n✗ Failed to start process: ${err.message}\n`)
      reject(err)
    })
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Process exited with code ${code ?? 'unknown'}`))
      }
    })
  })
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

  // Auto-activate if this is the first environment
  if (config.environments.length === 1) {
    config.active = body.name
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
  await writeWebEnvLocal(env)

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

// ── Operations (streaming) ────────────────────────────────────────────────────
//
// POST /api/environments/:name/seed  — hub:import (publish changed items only)
// POST /api/environments/:name/sync  — hub:import --republish (force-publish all)
// POST /api/environments/:name/wipe  — delete mapping + archive all content

app.post('/api/environments/:name/seed', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()
  const env = config.environments.find((e) => e.name === name)
  if (!env) return c.json({ error: `Environment "${name}" not found.` }, 404)

  // Seed = initial setup: force-republish everything so the hub is guaranteed live.
  return streamText(c, async (stream) => {
    await stream.writeln(`▶ Seeding "${env.label || env.name}" (force-republish all)…\n`)
    try {
      await runScript(
        stream,
        path.join(SCHEMAS_ROOT, 'scripts', 'hub-import.mjs'),
        ['all'],
        buildEnv(env, true),
      )
      await stream.writeln('\n✓ Seed complete.')
    } catch (err) {
      await stream.writeln(`\n✗ Seed failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
})

app.post('/api/environments/:name/sync', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()
  const env = config.environments.find((e) => e.name === name)
  if (!env) return c.json({ error: `Environment "${name}" not found.` }, 404)

  // Sync = ongoing updates: publish only new and changed items.
  return streamText(c, async (stream) => {
    await stream.writeln(`▶ Syncing "${env.label || env.name}"…\n`)
    try {
      await runScript(
        stream,
        path.join(SCHEMAS_ROOT, 'scripts', 'hub-import.mjs'),
        ['all'],
        buildEnv(env),
      )
      await stream.writeln('\n✓ Sync complete.')
    } catch (err) {
      await stream.writeln(`\n✗ Sync failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
})

app.post('/api/environments/:name/wipe', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()
  const env = config.environments.find((e) => e.name === name)
  if (!env) return c.json({ error: `Environment "${name}" not found.` }, 404)

  return streamText(c, async (stream) => {
    await stream.writeln(`▶ Wiping "${env.label || env.name}"…\n`)
    try {
      await runScript(stream, path.join(SCHEMAS_ROOT, 'scripts', 'hub-wipe.mjs'), [], buildEnv(env))
      await stream.writeln('\n✓ Wipe complete.')
    } catch (err) {
      await stream.writeln(`\n✗ Wipe failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`  ➜  API server running at http://localhost:${PORT}`)
  console.log(
    `  ➜  Config: ${existsSync(CONFIG_PATH) ? CONFIG_PATH : `${EXAMPLE_PATH} (example — will write to ${CONFIG_PATH})`}`,
  )
})
