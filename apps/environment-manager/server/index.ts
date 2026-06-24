import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Resolve quadratic.config.json at the monorepo root (two levels up from this package)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'quadratic.config.json')
const EXAMPLE_PATH = path.resolve(__dirname, '..', '..', '..', 'quadratic.config.example.json')
const PORT = 3099

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

  // If the name changed, update active pointer too
  if (name !== body.name && config.active === name) {
    config.active = body.name
  }

  config.environments[idx] = body
  await writeConfig(config)
  return c.json(config)
})

// PATCH /api/environments/:name/activate  — set as active
app.patch('/api/environments/:name/activate', async (c) => {
  const { name } = c.req.param()
  const config = await readConfig()

  if (!config.environments.some((e) => e.name === name)) {
    return c.json({ error: `Environment "${name}" not found.` }, 404)
  }

  config.active = name
  await writeConfig(config)
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

  // If the active env was deleted, fall back to the first remaining
  if (config.active === name) {
    config.active = config.environments[0]?.name ?? ''
  }

  await writeConfig(config)
  return c.json(config)
})

// ── Start ─────────────────────────────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`  ➜  API server running at http://localhost:${PORT}`)
  console.log(
    `  ➜  Config: ${existsSync(CONFIG_PATH) ? CONFIG_PATH : `${EXAMPLE_PATH} (example — will write to ${CONFIG_PATH})`}`,
  )
})
