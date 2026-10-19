import type { ContentBreakdown } from './content-rows.js'
import type { CellAction } from './flow-actions.js'
import type { FlowFixture, FlowsOverview, HubFlow } from './flow-rows.js'
import type { HubUnavailable } from './hub-reads.js'
import type { OpStep } from './op-log.js'
import type {
  Config,
  DiscoverResult,
  Environment,
  EnvironmentStats,
  FixtureSetInfo,
  PermissionsReport,
  VercelPreflight,
  WorkforceOrganizations,
} from './types.js'

/** What `GET /workforce/hubs/:name/flows` answers: the column, or why not. */
type HubPayloadFlows = { rows?: HubFlow[]; unavailable?: HubUnavailable }

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const json: unknown = await res.json()
  if (!res.ok) {
    const msg =
      typeof json === 'object' && json !== null && 'error' in json
        ? String(json.error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

export const api = {
  list: () => request<Config>('/environments'),
  add: (env: Environment) =>
    request<Config>('/environments', { method: 'POST', body: JSON.stringify(env) }),
  update: (name: string, env: Environment) =>
    request<Config>(`/environments/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(env),
    }),
  fixtureSets: () => request<FixtureSetInfo[]>('/fixture-sets'),
  /** `name` is a hub's identifier or a fixture set's — one of each is never active at once. */
  activate: (name: string) =>
    request<Config>(`/environments/${encodeURIComponent(name)}/activate`, { method: 'PATCH' }),
  remove: (name: string) =>
    request<Config>(`/environments/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  stats: (name: string) =>
    request<EnvironmentStats>(`/environments/${encodeURIComponent(name)}/stats`),
  contentBreakdown: (name: string) =>
    request<ContentBreakdown>(`/environments/${encodeURIComponent(name)}/content-breakdown`),
  permissions: (env: {
    clientId: string
    clientSecret: string
    hubId: string
    repoContent?: string
    repoSlots?: string
    repoSiteComponents?: string
  }) =>
    request<PermissionsReport>('/amplience/permissions', {
      method: 'POST',
      body: JSON.stringify(env),
    }),
  discover: (clientId: string, clientSecret: string) =>
    request<DiscoverResult>('/amplience/discover', {
      method: 'POST',
      body: JSON.stringify({ clientId, clientSecret }),
    }),
  cancel: (name: string) =>
    request<{ ok: boolean }>(`/environments/${encodeURIComponent(name)}/cancel`, {
      method: 'DELETE',
    }),
  vercelPreflight: () =>
    request<VercelPreflight>('/vercel/preflight', { method: 'POST', body: '{}' }),
  /** Workforce access (ADR-0023). Tokens go in; they never come back out. */
  workforceOrganizations: () => request<WorkforceOrganizations>('/workforce/organizations'),
  /** The whole Flows grid in one call — the fan-out happens server-side. */
  /**
   * The grid's rows, from disk. No Workforce call, so it answers immediately.
   *
   * Shaped as a map of subjects server-side, unwrapped here into the overview
   * the flows grid wants — the listeners and extensions grids will take their
   * own keys out of the same response.
   */
  flowFixtures: async (): Promise<FlowsOverview> => {
    const body = await request<{ flows: FlowFixture[]; flowsError?: string }>('/workforce/fixtures')
    return {
      fixtures: body.flows,
      hubs: [],
      ...(body.flowsError === undefined ? {} : { fixturesError: body.flowsError }),
    }
  },
  /**
   * One hub's flows.
   *
   * ⚠️ Passed to `useHubCells` by reference, so it must stay a stable
   * function. Defined as a property of this object rather than inline at the
   * call site for that reason.
   */
  hubFlows: (hub: string) =>
    request<HubPayloadFlows>(`/workforce/hubs/${encodeURIComponent(hub)}/flows`),
  /**
   * Run one per-cell flow operation. The response is small by design: the cell
   * shows a spinner then a tick, and `steps` goes to the shared log drawer.
   */
  flowOp: (action: CellAction, body: { hub: string; label: string; confirm?: string }) =>
    request<{
      ok: boolean
      action: string
      hub: string
      label: string
      steps: OpStep[]
      flowId?: string
      warnings?: string[]
      error?: string
    }>(`/workforce/flows/${action}`, { method: 'POST', body: JSON.stringify(body) }),
  saveWorkforceToken: (organizationId: string, token: string) =>
    request<WorkforceOrganizations>(
      `/workforce/organizations/${encodeURIComponent(organizationId)}/token`,
      { method: 'PUT', body: JSON.stringify({ token }) },
    ),
  removeWorkforceToken: (organizationId: string) =>
    request<WorkforceOrganizations>(
      `/workforce/organizations/${encodeURIComponent(organizationId)}/token`,
      { method: 'DELETE' },
    ),
  requestWorkforceToken: (organizationId: string) =>
    request<WorkforceOrganizations>(
      `/workforce/organizations/${encodeURIComponent(organizationId)}/token/request`,
      { method: 'POST', body: '{}' },
    ),
}
