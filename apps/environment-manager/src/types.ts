/** Sentinel name for the built-in "Local Fixtures" entry — never stored in config.json. */
export const FIXTURES_NAME = 'fixtures'

export type Environment = {
  name: string
  label: string
  hubName: string
  hubId: string
  localhostUrl: string
  repoContent: string
  repoSlots: string
  /**
   * "Site Components" repository — the authoring/permission boundary for
   * CMS-managed site config (currently just the custom-CSS content type).
   * Blank ("") when the deployment keeps all config in code, matching how
   * repoContent/repoSlots treat an unset value. Used only by the
   * management/seeding tooling; the delivery runtime never reads repo IDs.
   */
  repoSiteComponents: string
  /**
   * Shared secret the deployment's /api/revalidate-* routes check, and the
   * value seeded into the webhook headers that call them. Blank ("") means
   * the webhooks needing it are skipped rather than seeded unauthenticated.
   * It must match AMPLIENCE_REVALIDATE_SECRET on the deployment itself —
   * seeding the hub side alone gives a webhook that 401s.
   */
  revalidateSecret: string
  clientId: string
  clientSecret: string
  stagingHost: string
  defaultBrand: string
  defaultSite: string
  webApps: WebApp[]
  republish: boolean
  /**
   * Allow wipe/import to pass dc-cli's --ignoreSchemaValidation. Only works
   * on hubs whose "Ignore schema validation" setting is ON (org/hub admin,
   * DC → hub → Properties); passing it otherwise fails with
   * IGNORE_SCHEMA_VALIDATION_NOT_ENABLED, so it's opt-in per environment.
   * Optional: absent/false means never ignore validation.
   */
  ignoreSchemaValidation?: boolean
}

export type Config = {
  active: string
  environments: Environment[]
  /**
   * Brand the built-in Local Fixtures source renders under — the fixtures
   * equivalent of an environment's defaultBrand. Optional so configs written
   * before fixtures carried a brand still parse; absent means the base theme.
   */
  fixturesBrand?: string
}

export type EnvironmentStats = {
  workflowStates: number
  schemas: number
  types: number
  extensions: number
  webhooks: number
  items: number
}

export type WebApp = {
  label: string
  url: string
  brand: string
  name: string
  /**
   * The Vercel project this site was provisioned into via "Create Vercel
   * site" (ADR-0017). Absent for sites added via "Add existing site" — those
   * weren't created by Quadratic Lite, so there's nothing safe to destroy.
   */
  vercelProjectName?: string
  /** Vercel team (scope) the project lives under, if not the personal scope. */
  vercelScope?: string
}

export type DiscoveredRepo = {
  id: string
  name: string
  label: string
  features: string[]
}

export type DiscoveredHub = {
  id: string
  name: string
  label: string
  /**
   * Organization the hub belongs to. Workforce addresses a hub by an opaque id
   * built from this plus the hub id, so it is surfaced here even though nothing
   * stores it yet — the credentials probe derives it per call.
   */
  organizationId: string
  repos: DiscoveredRepo[]
  stagingHost?: string
}

export type DiscoverResult = {
  hubs: DiscoveredHub[]
}

// ── Permissions preflight (mirrors server/permissions.ts) ─────────────────────

export type CapabilityState = 'ok' | 'denied' | 'unknown' | 'error' | 'skipped'

export type PermissionCheck = {
  key: string
  label: string
  read: CapabilityState
  write: CapabilityState
  detail?: string
}

export type PermissionsReport = {
  hub: { id: string; readable: boolean; detail?: string }
  checks: PermissionCheck[]
  checkedAt: string
}

export type OpKey =
  | 'seed-settings'
  | 'sync-settings'
  | 'seed-schemas'
  | 'sync-schemas'
  | 'seed-types'
  | 'sync-types'
  | 'seed-extensions'
  | 'sync-extensions'
  | 'seed-webhooks'
  | 'sync-webhooks'
  | 'wipe-webhooks'
  | 'seed-items'
  | 'sync-items'
  | 'wipe-items'
  | 'seed-all'
  | 'sync-all'
  | 'wipe-all'

// ── Vercel provisioning (ADR-0017) ─────────────────────────────────────────────

export type VercelPreflight = {
  cliInstalled: boolean
  authenticated: boolean
  version?: string
  user?: string
  detail?: string
}

export type CreateVercelSiteInput = {
  brand: string
  sitename: string
  label: string
  projectName?: string
}

export const EMPTY_ENV: Environment = {
  name: '',
  label: '',
  hubName: '',
  hubId: '',
  localhostUrl: 'http://localhost:3000',
  repoContent: '',
  repoSlots: '',
  repoSiteComponents: '',
  revalidateSecret: '',
  clientId: '',
  clientSecret: '',
  stagingHost: '',
  defaultBrand: '',
  defaultSite: '',
  webApps: [],
  republish: false,
  ignoreSchemaValidation: false,
}
