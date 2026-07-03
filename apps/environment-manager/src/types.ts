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
  clientId: string
  clientSecret: string
  stagingHost: string
  defaultBrand: string
  /**
   * Delivery-key namespace for the hub's main frontend (SITE_NAME,
   * ADR-0014). Blank = the runtime default (the hub name).
   */
  mainSite: string
  webApps: WebApp[]
  republish: boolean
}

export type Config = {
  active: string
  environments: Environment[]
}

export type EnvironmentStats = {
  schemas: number
  types: number
  items: number
}

export type WebApp = {
  label: string
  url: string
  brand: string
  /** Delivery-key namespace the deployed site serves (its SITE_NAME, ADR-0014). */
  sitename: string
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

export type OpKey =
  | 'seed-schemas'
  | 'sync-schemas'
  | 'seed-types'
  | 'sync-types'
  | 'seed-items'
  | 'sync-items'
  | 'wipe-items'
  | 'seed-all'
  | 'sync-all'
  | 'wipe-all'

export const EMPTY_ENV: Environment = {
  name: '',
  label: '',
  hubName: '',
  hubId: '',
  localhostUrl: 'http://localhost:3000',
  repoContent: '',
  repoSlots: '',
  clientId: '',
  clientSecret: '',
  stagingHost: '',
  defaultBrand: '',
  mainSite: '',
  webApps: [],
  republish: false,
}
