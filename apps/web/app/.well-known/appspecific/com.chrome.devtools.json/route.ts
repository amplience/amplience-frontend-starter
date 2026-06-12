/**
 * Chrome DevTools automatic-workspace-folders endpoint.
 *
 * When DevTools is open on a localhost page, Chrome (M-136+) requests
 * `/.well-known/appspecific/com.chrome.devtools.json` to discover the
 * project folder behind the dev server. Answering it connects the repo as
 * a DevTools Workspace automatically: edits made in the Sources and
 * Elements panels persist to the files on disk instead of evaporating on
 * reload. Before this endpoint existed the probe fell through the
 * catch-all route to the branded 404 — a content lookup per probe and a
 * noisy line in the server log.
 *
 * The response shape is Chrome's spec exactly:
 * https://chromium.googlesource.com/devtools/devtools-frontend/+/main/docs/ecosystem/automatic_workspace_folders.md
 *
 *  - `root`: the workspace folder DevTools may map files into. The repo
 *    root (found by walking up to `pnpm-workspace.yaml`), not `apps/web` —
 *    sources under `packages/` map into the same workspace.
 *  - `uuid`: identifies the project so DevTools remembers the association.
 *    Derived deterministically from the root path (formatted as a v4
 *    UUID), so it's stable across restarts without writing a cache file
 *    anywhere; distinct checkouts of the repo get distinct identities.
 *
 * Development-only by definition: the path discloses an absolute
 * filesystem path, which is the feature's purpose on localhost and an
 * information leak anywhere else. Outside development the route answers a
 * plain 404, same as before, minus the content-client round trip.
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'

/** Walk up from the Next app dir to the pnpm workspace root. */
const repoRoot = (): string => {
  let dir = process.cwd()
  while (!existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir)
    if (parent === dir) return process.cwd() // no workspace marker — fall back
    dir = parent
  }
  return dir
}

/** A stable, syntactically valid v4-shaped UUID derived from a path. */
const uuidForPath = (p: string): string => {
  const hex = createHash('sha256').update(p).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function GET(): Response {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, { status: 404 })
  }
  const root = repoRoot()
  return Response.json({ workspace: { root, uuid: uuidForPath(root) } })
}
