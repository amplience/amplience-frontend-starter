// DAM (Content Hub) permission preflight for a hub credential pair.
//
// Seeding a new site with DynamicImage content (rather than ManualImage URLs)
// requires the credential pair to read and write the AssetStore linked to the
// DC hub. Those permissions live in Content Hub, which is a *separate* API from
// the DC Management API probed in `permissions.ts`:
//
//   - Different transport: the GraphQL Asset Management API
//     (https://api.amplience.net/graphql), not the REST Management API.
//   - Different permission model: DAM grants (`DAM:ASSET STORE:<name>`) are
//     provisioned independently of DC permissions, so a credential with full DC
//     access can have zero DAM access. The same OAuth client-credentials token
//     is used for both (one ID+secret per hub), so no extra config is needed.
//
// As with the DC probe, there is no "list my permissions" endpoint. Two
// observable signals substitute:
//
//   READ  — `viewer.mediaHubs.assetRepositories` returns the repositories the
//           credential can see. One or more repositories = readable; an auth
//           error or an empty list = denied.
//   WRITE — GraphQL exposes no "can I create?" flag on a repository, so write
//           is verified actively: create a tiny throwaway image asset with
//           `createAsset` and immediately `deleteAssets` it. Success = writable,
//           an authorization error = denied. `createAsset` (plain image from a
//           src URL) does not consume Amplience Credits — only the AI mutations
//           do — so the probe is free.
//
// Everything here is pure orchestration over an injected `gqlFetch`, so the
// logic is unit-testable without network access. The write probe's throwaway
// asset name and probe image are injectable for deterministic tests.

import { deepGet, gqlErrors, isAuthError, type GqlFetch, type GqlResult } from './graphql.ts'
import type { CapabilityState, PermissionCheck } from './permissions.ts'

/**
 * A small, publicly fetchable image used only to verify write access. The DAM
 * ingests it from this URL, then the probe deletes the resulting asset
 * immediately. Any valid public image URL works; this one is Amplience-owned
 * and already the image source used across the seed fixtures.
 */
const PROBE_IMAGE_URL =
  'https://cdn.media.amplience.net/i/quadraticdemo/about-a-head-for-the-headless-hero'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssetRepository = { id: string; label: string }

export type DamProbeOptions = {
  /**
   * Restrict the write probe to a repository whose label matches (case-
   * insensitive). Left unset today — the demo hubs expose a single store — but
   * a hook for the multi-store future so a shared AssetStore isn't written to
   * by accident. When unset, the first accessible repository is used.
   */
  repositoryLabel?: string
  /** Override the throwaway asset name (tests). Defaults to a unique name. */
  assetName?: () => string
  /** Override the probe image URL (tests). */
  probeImageUrl?: string
}

// ── GraphQL response helpers ────────────────────────────────────────────────────

/** Flatten `viewer.mediaHubs.assetRepositories` into a flat repository list. */
export function extractRepositories(body: unknown): AssetRepository[] {
  const hubEdges = deepGet(body, ['data', 'viewer', 'mediaHubs', 'edges'])
  if (!Array.isArray(hubEdges)) return []
  const repos: AssetRepository[] = []
  for (const hubEdge of hubEdges) {
    const repoEdges = deepGet(hubEdge, ['node', 'assetRepositories', 'edges'])
    if (!Array.isArray(repoEdges)) continue
    for (const repoEdge of repoEdges) {
      const node = deepGet(repoEdge, ['node'])
      if (typeof node !== 'object' || node === null) continue
      const id = 'id' in node ? String(node.id) : ''
      const label = 'label' in node ? String(node.label) : id === '' ? '' : id
      if (id !== '') repos.push({ id, label })
    }
  }
  return repos
}

// ── Read probe ──────────────────────────────────────────────────────────────────

const READ_QUERY =
  '{ viewer { mediaHubs { edges { node { assetRepositories(first: 50) { edges { node { id label } } } } } } } }'

export type ReadProbe = {
  state: CapabilityState
  repositories: AssetRepository[]
  detail?: string
}

/** Map a read-probe GraphQL result to a capability state + the repos it saw. */
export function readProbeState(res: GqlResult): ReadProbe {
  if (res.status === 401 || res.status === 403) {
    return { state: 'denied', repositories: [], detail: `read: HTTP ${String(res.status)}` }
  }
  if (res.status < 200 || res.status >= 300) {
    return { state: 'error', repositories: [], detail: `read: HTTP ${String(res.status)}` }
  }
  const errors = gqlErrors(res.body)
  if (isAuthError(errors)) {
    return { state: 'denied', repositories: [], detail: 'read: authorization denied' }
  }
  if (errors !== undefined) {
    return { state: 'error', repositories: [], detail: `read: ${errors[0].message}` }
  }
  const repositories = extractRepositories(res.body)
  if (repositories.length === 0) {
    return {
      state: 'denied',
      repositories,
      detail: 'no asset repositories accessible to these credentials',
    }
  }
  return { state: 'ok', repositories }
}

// ── Write probe ──────────────────────────────────────────────────────────────────

function createAssetMutation(repoId: string, name: string, src: string): string {
  // `name` is constrained to [a-z0-9-]; `repoId` is an opaque base64 id from the
  // API; `src` is a constant. None can break out of the string literals, so
  // inline interpolation is safe here (and matches the API's own examples).
  return `mutation { createAsset(input: { name: "${name}", type: IMAGE, filename: "${name}.jpg", src: "${src}", assetRepositoryId: "${repoId}" }) { id } }`
}

function deleteAssetsMutation(id: string): string {
  return `mutation { deleteAssets(input: { id: ["${id}"] }) }`
}

function defaultAssetName(): string {
  return `ql-cred-check-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Read the created asset id out of a `createAsset` response. */
function createdAssetId(body: unknown): string | undefined {
  const id = deepGet(body, ['data', 'createAsset', 'id'])
  return typeof id === 'string' && id !== '' ? id : undefined
}

export type WriteProbe = { state: CapabilityState; detail?: string }

/**
 * Verify write by creating a throwaway asset and deleting it. `repoLabel` is
 * woven into the detail so the operator can confirm which store was tested.
 */
export async function writeProbe(
  gqlFetch: GqlFetch,
  repo: AssetRepository,
  opts: DamProbeOptions = {},
): Promise<WriteProbe> {
  const name = (opts.assetName ?? defaultAssetName)()
  const src = opts.probeImageUrl ?? PROBE_IMAGE_URL
  const tested = `write tested against "${repo.label}"`

  const createRes = await gqlFetch(createAssetMutation(repo.id, name, src))

  if (createRes.status === 401 || createRes.status === 403) {
    return { state: 'denied', detail: `${tested}; HTTP ${String(createRes.status)}` }
  }
  const createErrors = gqlErrors(createRes.body)
  if (isAuthError(createErrors)) {
    return { state: 'denied', detail: `${tested}; authorization denied` }
  }
  if (createErrors !== undefined) {
    return { state: 'error', detail: `${tested}; ${createErrors[0].message}` }
  }
  const assetId = createdAssetId(createRes.body)
  if (assetId === undefined) {
    return { state: 'error', detail: `${tested}; no asset id returned` }
  }

  // Writable — clean up the throwaway asset. A cleanup failure doesn't change
  // the write verdict, but is surfaced so the stray asset can be removed.
  const deleteRes = await gqlFetch(deleteAssetsMutation(assetId))
  const deleteFailed =
    deleteRes.status < 200 || deleteRes.status >= 300 || gqlErrors(deleteRes.body) !== undefined
  if (deleteFailed) {
    return { state: 'ok', detail: `${tested}; test asset ${assetId} left behind — delete manually` }
  }
  return { state: 'ok', detail: tested }
}

// ── Report row ───────────────────────────────────────────────────────────────────

/**
 * Probe read + write access to the DAM AssetStore and return a single report
 * row (read = live query, write = create+delete of a throwaway asset). The
 * write probe only runs when a repository is readable; otherwise it is skipped.
 */
export async function buildDamCheck(
  gqlFetch: GqlFetch,
  opts: DamProbeOptions = {},
): Promise<PermissionCheck> {
  const label = 'DAM AssetStore (media library)'
  const read = readProbeState(await gqlFetch(READ_QUERY))

  if (read.state !== 'ok') {
    return {
      key: 'dam',
      label,
      read: read.state,
      write: 'skipped',
      detail: read.detail ?? 'read failed — write not tested',
    }
  }

  const target = pickRepository(read.repositories, opts.repositoryLabel)
  if (target === undefined) {
    return {
      key: 'dam',
      label,
      read: 'ok',
      write: 'skipped',
      detail: `no repository matching "${opts.repositoryLabel ?? ''}" to test write`,
    }
  }

  const write = await writeProbe(gqlFetch, target, opts)
  return {
    key: 'dam',
    label,
    read: 'ok',
    write: write.state,
    ...(write.detail !== undefined ? { detail: write.detail } : {}),
  }
}

/** Choose the repository to write-probe: labelled match if asked, else first. */
export function pickRepository(
  repositories: AssetRepository[],
  repositoryLabel?: string,
): AssetRepository | undefined {
  if (repositoryLabel === undefined || repositoryLabel === '') return repositories[0]
  return repositories.find((r) => r.label.toLowerCase() === repositoryLabel.toLowerCase())
}
