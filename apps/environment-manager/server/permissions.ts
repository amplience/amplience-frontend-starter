// Permission preflight for a hub credential pair (QL Environment Manager).
//
// The Management API has no "list my permissions" endpoint — functional
// permission sets are provisioned against the API key by Amplience and are
// not directly introspectable. Two observable signals substitute:
//
//   READ  — a harmless GET against each resource area the importer touches.
//           2xx = readable, 401/403 = denied, anything else = error.
//   WRITE — the HAL `_links` the API advertises on the hub / repo resource.
//           DC's hypermedia links are filtered by the caller's permissions
//           (the same signal dc-management-sdk-js uses to perform actions:
//           `create-content-type-schema`, `register-content-type`,
//           `create-extension`, `create-workflow-state`, `update-settings`,
//           `create-content-item`). A missing link means the API is not
//           offering that action to this credential.
//
// Everything here is pure orchestration over an injected `fetchJson`, so the
// logic is unit-testable without network access.

const AMPLIENCE_API = 'https://api.amplience.net/v2/content'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CapabilityState = 'ok' | 'denied' | 'unknown' | 'error' | 'skipped'

export type PermissionCheck = {
  /** Stable key, e.g. "schemas", "items-content". */
  key: string
  /** Human label shown in the GUI. */
  label: string
  read: CapabilityState
  write: CapabilityState
  /** Extra context — HTTP status, missing link rels, "not configured", … */
  detail?: string
}

export type PermissionsReport = {
  hub: { id: string; readable: boolean; detail?: string }
  checks: PermissionCheck[]
  checkedAt: string
}

export type HalLinks = Record<string, { href: string } | undefined>

/** Minimal fetch abstraction: GET a URL with auth already applied. */
export type FetchJson = (url: string) => Promise<{ status: number; body: unknown }>

export type PermissionsEnv = {
  hubId: string
  repoContent: string
  repoSlots: string
  repoSiteComponents?: string
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Map an HTTP status from a read probe to a capability state. */
export function readState(status: number): CapabilityState {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401 || status === 403) return 'denied'
  return 'error'
}

/**
 * Derive write capability from the presence of a HAL action link.
 * No links at all (hub/repo itself unreadable) → unknown rather than denied:
 * absence of evidence is only evidence of absence when the resource was
 * actually served.
 */
export function writeState(links: HalLinks | undefined, rel: string): CapabilityState {
  if (links === undefined) return 'unknown'
  return links[rel] !== undefined ? 'ok' : 'denied'
}

/** Pull `_links` out of an unknown response body, if present. */
export function extractLinks(body: unknown): HalLinks | undefined {
  if (typeof body !== 'object' || body === null || !('_links' in body)) return undefined
  const links = body._links
  if (typeof links !== 'object' || links === null) return undefined
  return links as HalLinks
}

/**
 * Combine several required action links into one write state.
 * All present → ok; any missing (with links served) → denied, detail lists
 * the missing rels; links unavailable → unknown.
 */
export function combinedWriteState(
  links: HalLinks | undefined,
  rels: string[],
): { state: CapabilityState; missing: string[] } {
  if (links === undefined) return { state: 'unknown', missing: [] }
  const missing = rels.filter((rel) => links[rel] === undefined)
  return { state: missing.length === 0 ? 'ok' : 'denied', missing }
}

// ── Report builder ────────────────────────────────────────────────────────────

const SKIPPED: PermissionCheck[] = []

function hubCheck(
  key: string,
  label: string,
  read: CapabilityState,
  readStatus: number,
  links: HalLinks | undefined,
  rels: string[],
): PermissionCheck {
  const { state: write, missing } = combinedWriteState(links, rels)
  const details: string[] = []
  if (read !== 'ok') details.push(`read: HTTP ${String(readStatus)}`)
  if (missing.length > 0) details.push(`missing link(s): ${missing.join(', ')}`)
  return {
    key,
    label,
    read,
    write,
    ...(details.length > 0 ? { detail: details.join('; ') } : {}),
  }
}

async function repoCheck(
  fetchJson: FetchJson,
  key: string,
  label: string,
  repoId: string,
): Promise<PermissionCheck> {
  if (repoId === '') {
    return { key, label, read: 'skipped', write: 'skipped', detail: 'not configured' }
  }
  const res = await fetchJson(`${AMPLIENCE_API}/content-repositories/${repoId}`)
  const read = readState(res.status)
  const links = read === 'ok' ? extractLinks(res.body) : undefined
  const write = writeState(links, 'create-content-item')
  const details: string[] = []
  if (read !== 'ok') {
    details.push(
      res.status === 404 ? `HTTP 404 — check the repository ID` : `HTTP ${String(res.status)}`,
    )
  } else if (write === 'denied') {
    details.push('missing link(s): create-content-item')
  }
  return {
    key,
    label,
    read,
    write,
    ...(details.length > 0 ? { detail: details.join('; ') } : {}),
  }
}

/**
 * Probe what the credential pair can actually do on this hub, mapped to the
 * resource areas the seed/sync/wipe operations touch. Read states come from
 * live GETs; write states from the HAL links the API chose to advertise.
 */
export async function buildPermissionsReport(
  env: PermissionsEnv,
  fetchJson: FetchJson,
): Promise<PermissionsReport> {
  const checkedAt = new Date().toISOString()
  const hubUrl = `${AMPLIENCE_API}/hubs/${env.hubId}`

  const hubRes = await fetchJson(hubUrl)
  const hubReadable = readState(hubRes.status) === 'ok'
  if (!hubReadable) {
    return {
      hub: {
        id: env.hubId,
        readable: false,
        detail: `Hub is not readable with these credentials (HTTP ${String(hubRes.status)}). All checks skipped.`,
      },
      checks: SKIPPED,
      checkedAt,
    }
  }
  const hubLinks = extractLinks(hubRes.body)

  const probe = async (path: string): Promise<{ state: CapabilityState; status: number }> => {
    const res = await fetchJson(`${hubUrl}/${path}?size=1`)
    return { state: readState(res.status), status: res.status }
  }

  const [
    workflowStates,
    schemas,
    types,
    extensions,
    webhooks,
    itemsContent,
    itemsSlots,
    itemsSite,
  ] = await Promise.all([
    probe('workflow-states'),
    probe('content-type-schemas'),
    probe('content-types'),
    probe('extensions'),
    probe('webhooks'),
    repoCheck(fetchJson, 'items-content', 'Content items (content repo)', env.repoContent),
    repoCheck(fetchJson, 'items-slots', 'Content items (slots repo)', env.repoSlots),
    repoCheck(
      fetchJson,
      'items-site-components',
      'Content items (site components repo)',
      env.repoSiteComponents ?? '',
    ),
  ])

  const checks: PermissionCheck[] = [
    hubCheck(
      'settings',
      'Settings (workflow states, locales)',
      workflowStates.state,
      workflowStates.status,
      hubLinks,
      ['create-workflow-state', 'update-settings'],
    ),
    hubCheck('schemas', 'Content type schemas', schemas.state, schemas.status, hubLinks, [
      'create-content-type-schema',
    ]),
    hubCheck('types', 'Content types', types.state, types.status, hubLinks, [
      'register-content-type',
    ]),
    hubCheck('extensions', 'Extensions', extensions.state, extensions.status, hubLinks, [
      'create-extension',
    ]),
    hubCheck('webhooks', 'Webhooks', webhooks.state, webhooks.status, hubLinks, ['create-webhook']),
    itemsContent,
    itemsSlots,
    itemsSite,
  ]

  return { hub: { id: env.hubId, readable: true }, checks, checkedAt }
}
