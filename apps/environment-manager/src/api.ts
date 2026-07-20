import type {
  Config,
  DiscoverResult,
  Environment,
  EnvironmentStats,
  PermissionsReport,
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
  activate: (name: string) =>
    request<Config>(`/environments/${encodeURIComponent(name)}/activate`, { method: 'PATCH' }),
  remove: (name: string) =>
    request<Config>(`/environments/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  stats: (name: string) =>
    request<EnvironmentStats>(`/environments/${encodeURIComponent(name)}/stats`),
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
}
