import type { ContentBreakdown } from './content-rows.js'
import type { CellAction } from './flow-actions.js'
import type { FlowsOverview } from './flow-rows.js'
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
  flows: () => request<FlowsOverview>('/workforce/flows'),
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
