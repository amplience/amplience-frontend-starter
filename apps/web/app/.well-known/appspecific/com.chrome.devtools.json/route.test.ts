// Unit tests for the DevTools automatic-workspace endpoint.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /.well-known/appspecific/com.chrome.devtools.json', () => {
  it('404s outside development (vitest runs as NODE_ENV=test)', () => {
    const res = GET()
    expect(res.status).toBe(404)
  })

  it('serves the workspace descriptor in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const res = GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { workspace: { root: string; uuid: string } }
    // Root is the monorepo root — the folder with the workspace manifest —
    // so sources under packages/ map into the same DevTools workspace.
    expect(path.isAbsolute(body.workspace.root)).toBe(true)
    expect(existsSync(path.join(body.workspace.root, 'pnpm-workspace.yaml'))).toBe(true)
    expect(body.workspace.uuid).toMatch(UUID_V4)
  })

  it('reports a stable uuid across requests', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const first = (await GET().json()) as { workspace: { uuid: string } }
    const second = (await GET().json()) as { workspace: { uuid: string } }
    expect(second.workspace.uuid).toBe(first.workspace.uuid)
  })

  // QL-40 — the repo-root walk's two remaining paths. Vitest itself runs
  // from the workspace root, so the walk normally terminates immediately;
  // these pin what happens when it actually has to move.

  it('walks up to the workspace root when the server starts in a subdirectory', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const realRoot = process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(realRoot, 'apps', 'web'))
    const body = (await GET().json()) as { workspace: { root: string } }
    expect(existsSync(path.join(body.workspace.root, 'pnpm-workspace.yaml'))).toBe(true)
  })

  it('falls back to cwd when no workspace marker exists above it', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    // The filesystem root is a real directory with no pnpm-workspace.yaml
    // anywhere up its (one-entry) chain.
    const fsRoot = path.parse(process.cwd()).root
    vi.spyOn(process, 'cwd').mockReturnValue(fsRoot)
    const body = (await GET().json()) as { workspace: { root: string; uuid: string } }
    expect(body.workspace.root).toBe(fsRoot)
    expect(body.workspace.uuid).toMatch(UUID_V4)
  })
})
