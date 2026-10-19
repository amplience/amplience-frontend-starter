// Where the Workforce personal access token lives, and how it is found (ADR-0023).
//
// A PAT is scoped to a user and an organization — not to a hub and not to a
// machine — so one token covers every hub in that organization. It is therefore
// stored against the organization in amplience.config.json rather than against
// each environment: a user may hold at most five tokens per organization, so
// one per hub was never an option at fourteen hubs.
//
// Pure: no I/O, so the resolution order, the redaction and "which hubs does this
// token already cover" are all testable without a config file or a network.

import { decodeId, deepGet, nodes } from './graphql.ts'

/** An organization's Workforce credential, as stored in amplience.config.json. */
export type Organization = {
  /** Amplience organization id, e.g. `org_cv6BwQhSuDQJBONk`. */
  id: string
  /** Optional human label, for when the panel names the organization. */
  label?: string
  /** The personal access token. Absent until one has been created or pasted in. */
  patToken?: string
  /**
   * When a token was requested (ISO-8601). A non-admin's "create token" click in
   * Dynamic Content submits a request an organization admin approves, so there
   * is a stretch with no token and nothing wrong — this is what tells that apart
   * from never having started.
   */
  patRequestedAt?: string
}

export type PatSource = 'env' | 'config'

/** `configured` carries a token; the other two are both "no token, yet". */
export type PatState = 'configured' | 'requested' | 'missing'

export type ResolvedPat = {
  state: PatState
  /** Set only when `state` is `configured`. */
  token?: string
  source?: PatSource
}

/**
 * Environment variables a token is read from, in order. `FLOWS_CLI_TOKEN` is
 * `@amplience/flows-cli`'s own variable: anyone already set up for that CLI is
 * set up for this, and the reverse.
 */
export const PAT_ENV_VARS = ['AMPLIENCE_PAT', 'FLOWS_CLI_TOKEN'] as const

/** Enough of an environment to say which hubs a token covers. */
export type HubRef = { name: string; label: string; organizationId?: string }

/** An organization as the GUI is allowed to see it — never the token itself. */
export type PublicOrganization = {
  id: string
  label?: string
  hasToken: boolean
  patRequestedAt?: string
  /** Labels of the configured hubs in this organization. */
  hubs: string[]
}

function nonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function findOrganization(
  organizations: Organization[],
  organizationId: string | undefined,
): Organization | undefined {
  if (!nonEmpty(organizationId)) return undefined
  return organizations.find((org) => org.id === organizationId)
}

/**
 * Find the token to authenticate Workforce calls for a hub in `organizationId`.
 *
 * An environment variable wins over stored config, and applies whatever the
 * organization — it is the override for a one-off run or a CI job, where no
 * config file has been through the setup panel.
 */
export function resolvePat(
  organizations: Organization[],
  organizationId: string | undefined,
  env: Record<string, string | undefined> = {},
): ResolvedPat {
  for (const name of PAT_ENV_VARS) {
    const value = env[name]
    if (nonEmpty(value)) return { state: 'configured', token: value.trim(), source: 'env' }
  }

  const org = findOrganization(organizations, organizationId)
  if (org === undefined) return { state: 'missing' }
  if (nonEmpty(org.patToken)) {
    return { state: 'configured', token: org.patToken.trim(), source: 'config' }
  }
  return { state: nonEmpty(org.patRequestedAt) ? 'requested' : 'missing' }
}

/** Apply a patch to one organization, adding it when it isn't there yet. */
export function upsertOrganization(
  organizations: Organization[],
  organizationId: string,
  patch: Omit<Partial<Organization>, 'id'>,
): Organization[] {
  const existing = findOrganization(organizations, organizationId)
  if (existing === undefined) {
    return [...organizations, { id: organizationId, ...patch }]
  }
  return organizations.map((org) => (org.id === organizationId ? { ...org, ...patch } : org))
}

/** Record a token, clearing any outstanding request for one. */
export function storeToken(
  organizations: Organization[],
  organizationId: string,
  token: string,
): Organization[] {
  return upsertOrganization(organizations, organizationId, { patToken: token.trim() }).map(
    (org) => {
      if (org.id !== organizationId) return org
      const { patRequestedAt: _cleared, ...rest } = org
      return rest
    },
  )
}

/** The hubs a token for this organization would cover, by label. */
export function hubsCovered(hubs: HubRef[], organizationId: string | undefined): string[] {
  if (!nonEmpty(organizationId)) return []
  return hubs.filter((hub) => hub.organizationId === organizationId).map((hub) => hub.label)
}

/** Strip the tokens before anything leaves the server. */
export function publicOrganizations(
  organizations: Organization[],
  hubs: HubRef[],
): PublicOrganization[] {
  return organizations.map((org) => ({
    id: org.id,
    ...(org.label !== undefined ? { label: org.label } : {}),
    hasToken: nonEmpty(org.patToken),
    ...(org.patRequestedAt !== undefined ? { patRequestedAt: org.patRequestedAt } : {}),
    hubs: hubsCovered(hubs, org.id),
  }))
}

// ── Naming an organization ────────────────────────────────────────────────────

/**
 * Read the organizations this token can see. Hubs hang off organizations, so
 * this is also the only way to learn an organization's human label — and it
 * needs a token, which is why the setup panel names the organization by the
 * hubs it covers until one exists.
 *
 * Fifty is well past the number anyone holds, so this does not paginate.
 */
export const ORGANIZATIONS_QUERY = `query organizations {
  viewer { organizations(first: 50) { edges { node { id name label } } } }
}`

/** One organization as the token's own view of the world reports it. */
export type TokenOrganization = { id: string; label?: string }

/**
 * The organizations a token can see, with the bare `org_…` ids everything on
 * our side uses.
 *
 * The `id` comes back as a Relay global id — `base64("Organization:org_…")` —
 * so it is decoded here; an id that is already bare is passed through, in case
 * that ever changes.
 */
export function organizationsIn(body: unknown): TokenOrganization[] {
  const found: TokenOrganization[] = []
  for (const node of nodes(deepGet(body, ['data', 'viewer', 'organizations']))) {
    const id = deepGet(node, ['id'])
    if (typeof id !== 'string' || id === '') continue
    const decoded = decodeId(id)
    const bare = decoded === undefined ? id : (decoded.split(':').pop() ?? id)
    const label = ['label', 'name']
      .map((key) => deepGet(node, [key]))
      .find((value) => typeof value === 'string' && value.trim() !== '')
    found.push({
      id: bare,
      ...(typeof label === 'string' ? { label: label.trim() } : {}),
    })
  }
  return found
}

/** Pick one organization's label out of that response. */
export function organizationLabelOf(body: unknown, organizationId: string): string | undefined {
  if (organizationId === '') return undefined
  return organizationsIn(body).find((org) => org.id === organizationId)?.label
}

/**
 * Forget an organization's token. The entry itself goes too when nothing is
 * left on it, so a config that never had Workforce set up looks like one that
 * never had it rather than carrying an empty husk.
 */
export function removeToken(organizations: Organization[], organizationId: string): Organization[] {
  return organizations.flatMap((org) => {
    if (org.id !== organizationId) return [org]
    const { patToken: _token, patRequestedAt: _requested, ...rest } = org
    return rest.label === undefined ? [] : [rest]
  })
}
