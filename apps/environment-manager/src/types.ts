/** Sentinel name for the built-in "Local Fixtures" entry — never stored in config.json. */
/**
 * The pre-set-aware name for the offline source. The server migrates it to the
 * default set's name on read, and still accepts it when activating.
 */
export const FIXTURES_NAME = 'fixtures'

/**
 * A fixture set as the server reports it, read from its `set.json` (ADR-0019).
 * The name is both the set's identity and its delivery-key namespace.
 */
export type FixtureSetInfo = {
  name: string
  label: string
  description: string
  defaultBrand: string
  defaultLocale: string
  authoredLocales: string[]
  generatedDocs: boolean
}

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
  /**
   * Which fixture set this hub's sites carry when their own names don't say
   * (ADR-0019) — the partner path, where starter content is seeded under
   * another namespace. A site named after a set serves that set regardless.
   */
  defaultFixtureSet?: string
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
  /**
   * The hub's configured locales (ADR-0019 §6.6). Support sets these per hub, so
   * they vary; a set's authored locales are reconciled against them at seed
   * time. Empty when the probe failed or the hub has none configured.
   */
  locales: string[]
}

export type WebApp = {
  label: string
  url: string
  brand: string
  name: string
  /**
   * The Vercel project this site was provisioned into via "Create Vercel
   * site" (ADR-0017). Absent for sites added via "Add existing site" — those
   * weren't created by Amplience Frontend Starter, so there's nothing safe to destroy.
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
  | 'wipe-schemas'
  | 'seed-types'
  | 'sync-types'
  | 'wipe-types'
  | 'seed-extensions'
  | 'sync-extensions'
  | 'wipe-extensions'
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
