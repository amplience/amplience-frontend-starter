/**
 * The round-trips the flow and listener commands share (ADR-0023).
 *
 * Not pure, but every failure is an `Error` rather than a `process.exit`, so a
 * caller decides how to report it and the module stays testable.
 *
 * ⚠️ Two APIs, two credentials. Workforce speaks GraphQL and accepts **only** a
 * personal access token — a hub's client-credentials pair is refused outright.
 * The Management API still answers for the two things Workforce does not carry:
 * a hub's organization, which is half of the opaque Workforce hub id, and
 * workflow-state labels, which are a Dynamic Content concept.
 */

export const GRAPHQL_API = 'https://api.amplience.net/graphql'
export const AMPLIENCE_API = 'https://api.amplience.net/v2/content'
export const AMPLIENCE_AUTH = 'https://auth.amplience.net/oauth/token'

/** Where a personal access token is looked for, in order. */
export const PAT_ENV_VARS = ['AMPLIENCE_PAT', 'FLOWS_CLI_TOKEN']

export function requiredEnv(name, why, env = process.env) {
  const value = env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `${name} is not set — it is needed to ${why}. Activate a hub in the Environment Manager, ` +
        `or set it in packages/hub-management/.env.`,
    )
  }
  return value.trim()
}

export function personalAccessToken(env = process.env) {
  for (const name of PAT_ENV_VARS) {
    const value = env[name]
    if (value !== undefined && value.trim() !== '') return value.trim()
  }
  throw new Error(
    'No personal access token. Flow management does not accept the hub credentials — set one up ' +
      'under the Workforce row of the credentials check in the Environment Manager, or export ' +
      'AMPLIENCE_PAT.',
  )
}

/**
 * Post a GraphQL operation.
 *
 * ⚠️ A rejected query comes back as HTTP 400 *with* the reason in `errors`, so
 * the body is read before the status code — branching on the status first
 * throws away the only informative part.
 */
export async function graphql(token, query, variables) {
  const res = await fetch(GRAPHQL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json().catch(() => null)
  const message = body?.errors?.[0]?.message
  if (message !== undefined) throw new Error(`Workforce API: ${message}`)
  if (!res.ok) throw new Error(`Workforce API: HTTP ${res.status}`)
  return body?.data
}

export async function managementToken(env = process.env) {
  const res = await fetch(AMPLIENCE_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: requiredEnv('AMPLIENCE_CLIENT_ID', 'read the hub over the Management API', env),
      client_secret: requiredEnv(
        'AMPLIENCE_CLIENT_SECRET',
        'read the hub over the Management API',
        env,
      ),
    }),
  })
  if (!res.ok) throw new Error(`Amplience auth failed: HTTP ${res.status}`)
  return (await res.json()).access_token
}

export async function managementGet(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Management API ${res.status}: ${url}`)
  return res.json()
}

/** The opaque id Workforce addresses a hub by: base64 of `CMSHub:<org>/<hub>`. */
export const cmsHubId = (organizationId, hubId) =>
  Buffer.from(`CMSHub:${organizationId}/${hubId}`, 'utf8').toString('base64')

/**
 * The hub's organization, from the environment if the Environment Manager wrote
 * it, and otherwise from the hub itself. It is half of the Workforce hub id.
 */
export async function organizationOf(mgmtToken, hubId, env = process.env) {
  const configured = env.AMPLIENCE_ORGANIZATION_ID?.trim()
  if (configured !== undefined && configured !== '') return configured
  const hub = await managementGet(mgmtToken, `${AMPLIENCE_API}/hubs/${hubId}`)
  const organizationId = hub?.organizationId
  if (typeof organizationId !== 'string' || organizationId === '') {
    throw new Error(
      `Hub ${hubId} reported no organizationId, so the Workforce hub id cannot be built.`,
    )
  }
  return organizationId
}

// ── The hub registry ──────────────────────────────────────────────────────────

/**
 * What an instance exposes, richest first.
 *
 * `extensionRelease { id }` is confirmed — the browser extension's import has
 * been querying it for months. `version` on that release is not: it is where
 * the hub plausibly gets the `(v2.2.0)` half of an instance's picker title, but
 * nothing has run it. So the richer shape is tried and the lean one is the
 * fallback, which costs one rejected query on a hub that does not support it
 * and keeps the command working either way.
 */
const INSTANCE_SHAPES = [
  { fields: 'id label extension { id } extensionRelease { id version }', version: 'field' },
  { fields: 'id label extension { id } extensionRelease { id label }', version: 'label' },
  { fields: 'id label extension { id } extensionRelease { id }', version: 'none' },
  { fields: 'id label extension { id }', version: 'none' },
]

/** What falling back to this shape costs, in words worth reading. */
const FALLBACK_NOTE = {
  label:
    "This hub's API has no `version` on an extension release, so instance versions are being " +
    'read from the release label instead. A release named rather than numbered ("Latest") yields ' +
    'no version, and those handles match on label alone.',
  none:
    "This hub's API exposes neither `version` nor `label` on an extension release, so instance " +
    'handles carry no version at all and match on label alone — coarser than intended. Worth ' +
    'reporting.',
}

/**
 * A release label that is really a version.
 *
 * quadraticlite's API has no `version` on a release but does have `label`, and
 * an instance's picker title reads `Amplience Dynamic Content (v2.2.0)` — so the
 * label is where that number comes from. Only a label that looks like a version
 * is used as one: releases can be named anything, and a handle built from
 * "Latest" would match nothing and mean less than no version at all.
 */
const VERSION_LABEL = /^v?(\d+(?:\.\d+)*)$/

export function versionFrom(release) {
  if (typeof release?.version === 'string' && release.version.trim() !== '') {
    return release.version.trim()
  }
  const match = VERSION_LABEL.exec((release?.label ?? '').trim())
  return match === null ? undefined : match[1]
}

/** The API's maximum page size. Asking for more is refused, not clamped. */
export const PAGE_SIZE = 50

const registryQuery = (instanceShape) => `query registry($hubId: ID!) {
  cmsHub(id: $hubId) {
    extensionInstances { ${instanceShape} }
  }
}`

const LISTENERS_QUERY = `query listeners($hubId: ID!, $first: Int!, $after: String) {
  cmsHub(id: $hubId) {
    webhookListeners(first: $first, after: $after) {
      edges { node { id label url } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`

/**
 * Every webhook listener on the hub.
 *
 * ⚠️ Paged rather than taken in one gulp. `webhookListeners` is a Relay
 * connection, so an unpaged read quietly stops at the default page size — and a
 * listener that exists but was not returned reads as missing, which would make
 * the seed create a second one under the same label.
 */
export async function readListeners(token, hubRef) {
  const listeners = []
  let after
  do {
    const page = (await graphql(token, LISTENERS_QUERY, { hubId: hubRef, first: PAGE_SIZE, after }))
      ?.cmsHub?.webhookListeners
    for (const edge of page?.edges ?? []) if (edge?.node != null) listeners.push(edge.node)
    after = page?.pageInfo?.hasNextPage === true ? page.pageInfo.endCursor : undefined
  } while (after !== undefined)
  return listeners
}

/**
 * Read the hub's extension instances, listeners and workflow states.
 *
 * Shared by pull and push, which need the same three lists read the same way —
 * pull turns the hub's ids into tokens, push turns the tokens back into ids.
 */
export async function readRegistry(token, mgmtToken, hubId, organizationId) {
  const hubRef = cmsHubId(organizationId, hubId)
  const warnings = []

  let hub
  for (const [index, shape] of INSTANCE_SHAPES.entries()) {
    try {
      hub = (await graphql(token, registryQuery(shape.fields), { hubId: hubRef }))?.cmsHub ?? {}
      if (index > 0) warnings.push(FALLBACK_NOTE[shape.version])
      break
    } catch (error) {
      if (index === INSTANCE_SHAPES.length - 1) throw error
    }
  }

  // Workflow states are a Dynamic Content concept, so they come from the
  // Management API rather than from Workforce. The embedded key has been seen
  // spelled both ways, so take whichever is there rather than guessing.
  const body = await managementGet(
    mgmtToken,
    `${AMPLIENCE_API}/hubs/${hubId}/workflow-states?size=100`,
  )
  const embedded = body?._embedded ?? {}
  const states = embedded['workflow-states'] ?? embedded.workflowStates ?? []

  return {
    registry: shapeRegistry({ ...hub, listeners: await readListeners(token, hubRef) }, states),
    warnings,
  }
}

/** Turn the two API shapes into the one the pure modules take. */
export function shapeRegistry(hub, states) {
  return {
    extensionInstances: (hub?.extensionInstances ?? [])
      .filter((i) => typeof i?.id === 'string' && typeof i.extension?.id === 'string')
      .map((i) => ({
        id: i.id,
        extensionId: i.extension.id,
        ...(typeof i.label === 'string' ? { label: i.label } : {}),
        ...(versionFrom(i.extensionRelease) === undefined
          ? {}
          : { version: versionFrom(i.extensionRelease) }),
        ...(typeof i.extensionRelease?.id === 'string' ? { releaseId: i.extensionRelease.id } : {}),
      })),
    listeners: (hub?.listeners ?? [])
      .filter((node) => typeof node?.id === 'string' && typeof node.label === 'string')
      .map((node) => ({
        id: node.id,
        label: node.label,
        ...(typeof node.url === 'string' ? { url: node.url } : {}),
      })),
    workflowStates: (states ?? [])
      .filter((s) => typeof s?.id === 'string' && typeof s.label === 'string')
      .map((s) => ({ id: s.id, label: s.label })),
  }
}

/** One listener, fully — the list query omits `schema`, which push replays. */
const LISTENER_QUERY = `query listener($id: ID!) {
  webhookListener(id: $id) { id label schema }
}`

/**
 * Fill in the `schema` of the listeners a flow actually binds to.
 *
 * ⚠️ Shared by `flows:push` and the Environment Manager's Flows tab on
 * purpose. The declaration a flow is pushed with replays each bound listener's
 * schema, and the list query does not return one — so an implementation that
 * drifted between the two callers would produce a flow that imports cleanly
 * and then misbehaves on the hub that got it from the other path. The listener
 * label has already cost us once that way (QL-161).
 *
 * Only the needed ones are fetched: this is one round-trip per listener, and a
 * hub can hold far more than a flow refers to.
 */
export async function listenerSchemas(token, listeners, needed) {
  const filled = []
  for (const listener of listeners ?? []) {
    if (!needed.has(listener.label)) {
      filled.push(listener)
      continue
    }
    const full = (await graphql(token, LISTENER_QUERY, { id: listener.id }))?.webhookListener
    filled.push({ ...listener, ...(full ?? {}) })
  }
  return filled
}
