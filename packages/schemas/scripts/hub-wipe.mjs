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
 *   2. Archives every content item in the content and slots repositories
 *      so previously-published items stop being served by Delivery.
 *
 * Configuration is read from environment variables (same set as
 * hub-import.mjs). Run via the environment-manager GUI which injects
 * the selected environment's credentials directly, or manually:
 *
 *   AMPLIENCE_HUB_NAME=myhub \
 *   AMPLIENCE_REPO_CONTENT=abc123 \
 *   AMPLIENCE_REPO_SLOTS=def456 \
 *   node packages/schemas/scripts/hub-wipe.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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

// ── Main ─────────────────────────────────────────────────────────────────────

const hubName = require_('AMPLIENCE_HUB_NAME', 'identify the hub mapping file')
const contentRepo = require_('AMPLIENCE_REPO_CONTENT', 'target the content repository')
const slotsRepo = require_('AMPLIENCE_REPO_SLOTS', 'target the slots repository')

// 1. Delete mapping file
const mapFile = path.join(os.homedir(), '.amplience', 'imports', `quadratic-${hubName}.json`)
if (existsSync(mapFile)) {
  rmSync(mapFile)
  console.log(`✓ Deleted mapping file: ${mapFile}`)
} else {
  console.log(`  Mapping file not present (already clean): ${mapFile}`)
}

// 2. Archive all content items in both repos.
// Omitting the id positional archives all items in scope (dc-cli behaviour).
// --repoId scopes to the target repo; -f skips the confirmation prompt.
console.log(`\nArchiving all content in content repo (${contentRepo})…`)
await dcCli('content-item', 'archive', '--repoId', contentRepo, '-f')

console.log(`\nArchiving all content in slots repo (${slotsRepo})…`)
await dcCli('content-item', 'archive', '--repoId', slotsRepo, '-f')

console.log('\n✓ Hub wipe complete — run Seed to repopulate from fixtures.')
