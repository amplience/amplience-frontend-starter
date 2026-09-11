// Workforce permission preflight for a hub credential pair (ADR-0023).
//
// Workforce content flows are managed through the GraphQL API rather than the
// REST Management API probed in `permissions.ts`, so this probe sits alongside
// `dam-permissions.ts` and shares its client (`graphql.ts`) and token.
//
// One wrinkle drives the shape of this module: Workforce addresses a hub by an
// opaque id — base64 of `CMSHub:<orgId>/<dcHubId>` — while the Environment
// Manager stores only the bare `<dcHubId>`. That id is derived rather than
// allocated, so the probe reads `organizationId` off the DC hub (which the
// Management API returns) and constructs it. Nothing has to be configured, and
// no GraphQL hub-listing query is involved: `viewer` resolves to a `User`, which
// has no hub collection.
//
// As with the DAM probe there is no "list my permissions" endpoint, so:
//   READ  — list the hub's content flows.
//   WRITE — create an empty throwaway flow and delete it again.

import {
  deepGet,
  extensionValue,
  gqlErrors,
  isAuthError,
  type GqlFetch,
  type GqlResult,
} from './graphql.ts'
import {
  AMPLIENCE_API,
  type CapabilityState,
  type FetchJson,
  type PermissionCheck,
} from './permissions.ts'

export const WORKFORCE_KEY = 'workforce'
export const WORKFORCE_LABEL = 'Workforce content flows'

/**
 * The flow body used to verify write access: no actions, so nothing for the
 * validator to reject as an unknown action type (`virtualActions` is the flow's
 * type-declaration table, and an empty graph declares nothing).
 */
const PROBE_FLOW = JSON.stringify({ actions: [], edges: [], virtualActions: [] })

const PROBE_DESCRIPTION =
  'Temporary flow created by the Environment Manager credentials check. Safe to delete.'

// ── Queries ───────────────────────────────────────────────────────────────────

const FLOWS_QUERY = `query flows($hubId: ID!) {
  cmsHub(id: $hubId) { contentFlows { edges { node { id } } } }
}`

const CREATE_FLOW = `mutation createProbeFlow($hubId: ID!, $label: String!, $description: String!, $flow: String!) {
  createContentFlow(input: { label: $label, description: $description, flow: $flow, cmsHubId: $hubId }) { id }
}`

const DELETE_FLOW = `mutation deleteProbeFlow($flowId: ID!) {
  deleteContentFlow(input: { id: $flowId })
}`

// ── Opaque id helpers ─────────────────────────────────────────────────────────

/** Decode an opaque `Type:value` id, or undefined if it isn't one. */
export function decodeId(opaque: string): string | undefined {
  let decoded: string
  try {
    decoded = Buffer.from(opaque, 'base64').toString('utf8')
  } catch {
    return undefined
  }
  return /^[A-Za-z]+:[\w\-/.@+]+$/.test(decoded) ? decoded : undefined
}

/** The DC hub id embedded in an opaque `CMSHub:<orgId>/<dcHubId>` id. */
export function dcHubIdOf(cmsHubId: string): string | undefined {
  const decoded = decodeId(cmsHubId)
  if (decoded?.startsWith('CMSHub:') !== true) return undefined
  const tail = decoded.slice('CMSHub:'.length)
  const slash = tail.lastIndexOf('/')
  return slash === -1 ? undefined : tail.slice(slash + 1)
}

/** Build the opaque cmsHub id Workforce addresses a hub by. */
export function cmsHubIdFor(organizationId: string, dcHubId: string): string {
  return Buffer.from(`CMSHub:${organizationId}/${dcHubId}`, 'utf8').toString('base64')
}

/** Read `organizationId` off a DC hub response body. */
export function organizationIdOf(body: unknown): string | undefined {
  const id = deepGet(body, ['organizationId'])
  return typeof id === 'string' && id !== '' ? id : undefined
}

// ── Result classification ─────────────────────────────────────────────────────

/** True when a mutation was rejected for being an invalid flow, not for auth. */
export function isValidationError(res: GqlResult): boolean {
  const errors = gqlErrors(res.body)
  if (errors === undefined) return false
  return (
    errors.some((e) => /invalid workflow|validation/i.test(e.message)) ||
    (Array.isArray(deepGet(res.body, ['errors'])) &&
      (deepGet(res.body, ['errors']) as unknown[]).some(
        (e) => extensionValue(e, 'reason') === 'WORKFLOW_VALIDATION_FAILED',
      ))
  )
}

/** Render a GraphQL error as `message (CODE)` for a report detail. */
function describe(error: { message: string; code?: string } | undefined): string {
  if (error === undefined) return 'no message returned'
  return error.code === undefined ? error.message : `${error.message} (${error.code})`
}

export type Classified = { state: CapabilityState; detail?: string }

/**
 * Map a GraphQL result to a capability state. `denied` is reserved for
 * authorization failures; anything else that went wrong is `error`, so a broken
 * probe is never reported as a missing permission.
 */
export function classify(res: GqlResult, what: string): Classified {
  // Errors are read before the status code: GraphQL reports a rejected query as
  // HTTP 400 *with* an `errors` array explaining why, so checking the status
  // first would discard the only useful part of the response.
  const errors = gqlErrors(res.body)
  if (errors !== undefined) {
    // The API's own wording is carried through even on a denial: "denied" alone
    // can't be told apart from this code mis-classifying an unrelated error,
    // and the message is usually the only clue to which grant is missing.
    if (isAuthError(errors)) {
      return { state: 'denied', detail: `${what}: denied — ${describe(errors[0])}` }
    }
    const status = res.status >= 400 ? ` (HTTP ${String(res.status)})` : ''
    return { state: 'error', detail: `${what}: ${describe(errors[0])}${status}` }
  }
  if (res.status === 401 || res.status === 403) {
    return { state: 'denied', detail: `${what}: HTTP ${String(res.status)}` }
  }
  if (res.status < 200 || res.status >= 300) {
    return { state: 'error', detail: `${what}: HTTP ${String(res.status)}` }
  }
  return { state: 'ok' }
}

// ── Probes ────────────────────────────────────────────────────────────────────

export type WorkforceProbeOptions = {
  /** Skip resolution entirely when the opaque hub id is already known. */
  cmsHubId?: string
  /** Skip the hub read when the organization id is already to hand. */
  organizationId?: string
  /** Override the throwaway flow label (tests). */
  flowLabel?: () => string
}

function defaultFlowLabel(): string {
  return `ql-cred-check-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type Resolved = { cmsHubId?: string; state: CapabilityState; detail?: string }

/**
 * Work out the opaque cmsHub id for a DC hub id, by reading the hub's
 * `organizationId` from the Management API and constructing it.
 */
export async function resolveCmsHubId(
  fetchJson: FetchJson,
  dcHubId: string,
  opts: WorkforceProbeOptions = {},
): Promise<Resolved> {
  if (opts.cmsHubId !== undefined && opts.cmsHubId !== '') {
    return { cmsHubId: opts.cmsHubId, state: 'ok' }
  }
  if (opts.organizationId !== undefined && opts.organizationId !== '') {
    return { cmsHubId: cmsHubIdFor(opts.organizationId, dcHubId), state: 'ok' }
  }

  const res = await fetchJson(`${AMPLIENCE_API}/hubs/${dcHubId}`)
  if (res.status === 401 || res.status === 403) {
    return { state: 'denied', detail: `hub lookup: HTTP ${String(res.status)}` }
  }
  if (res.status < 200 || res.status >= 300) {
    return { state: 'error', detail: `hub lookup: HTTP ${String(res.status)}` }
  }

  const organizationId = organizationIdOf(res.body)
  if (organizationId === undefined) {
    // Not a permissions verdict: the hub read fine, it just did not carry the
    // one field the Workforce hub id is built from.
    return {
      state: 'unknown',
      detail: `hub ${dcHubId} was readable but returned no organizationId, so the Workforce hub id could not be built`,
    }
  }
  return { cmsHubId: cmsHubIdFor(organizationId, dcHubId), state: 'ok' }
}

/**
 * Verify write by creating an empty throwaway flow and deleting it. A rejection
 * for invalid flow content means the probe payload is wrong rather than the
 * credentials lacking access, so that reports `unknown`, not `denied`.
 */
export async function writeProbe(
  gqlFetch: GqlFetch,
  cmsHubId: string,
  opts: WorkforceProbeOptions = {},
): Promise<Classified> {
  const label = (opts.flowLabel ?? defaultFlowLabel)()
  const createRes = await gqlFetch(CREATE_FLOW, {
    hubId: cmsHubId,
    label,
    description: PROBE_DESCRIPTION,
    flow: PROBE_FLOW,
  })

  if (isValidationError(createRes)) {
    return {
      state: 'unknown',
      detail: 'write not verified: the empty probe flow was rejected as invalid',
    }
  }
  const created = classify(createRes, 'write')
  if (created.state !== 'ok') return created

  const flowId = deepGet(createRes.body, ['data', 'createContentFlow', 'id'])
  if (typeof flowId !== 'string' || flowId === '') {
    return { state: 'error', detail: 'write: no flow id returned' }
  }

  // Writable — remove the throwaway flow. A failed cleanup doesn't change the
  // verdict, but the label is surfaced so it can be deleted by hand.
  const deleteRes = await gqlFetch(DELETE_FLOW, { flowId })
  if (classify(deleteRes, 'cleanup').state !== 'ok') {
    return { state: 'ok', detail: `test flow "${label}" left behind — delete it manually` }
  }
  return { state: 'ok' }
}

// ── Report row ────────────────────────────────────────────────────────────────

/**
 * Probe read + write access to Workforce content flows and return one report
 * row. Write is only attempted once read has succeeded.
 */
export async function buildWorkforceCheck(
  gqlFetch: GqlFetch,
  fetchJson: FetchJson,
  dcHubId: string,
  opts: WorkforceProbeOptions = {},
): Promise<PermissionCheck> {
  const row = (
    read: CapabilityState,
    write: CapabilityState,
    detail?: string,
  ): PermissionCheck => ({
    key: WORKFORCE_KEY,
    label: WORKFORCE_LABEL,
    read,
    write,
    ...(detail !== undefined ? { detail } : {}),
  })

  const resolved = await resolveCmsHubId(fetchJson, dcHubId, opts)
  if (resolved.cmsHubId === undefined) {
    return row(resolved.state, 'skipped', resolved.detail ?? 'hub not resolved — nothing tested')
  }

  const read = classify(await gqlFetch(FLOWS_QUERY, { hubId: resolved.cmsHubId }), 'read')
  if (read.state !== 'ok') {
    return row(read.state, 'skipped', read.detail ?? 'read failed — write not tested')
  }

  const write = await writeProbe(gqlFetch, resolved.cmsHubId, opts)
  return row('ok', write.state, write.detail)
}
