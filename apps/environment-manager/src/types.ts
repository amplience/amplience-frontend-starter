/** Sentinel name for the built-in "Local Fixtures" entry — never stored in config.json. */
export const FIXTURES_NAME = 'fixtures'

export type Environment = {
  name: string
  label: string
  hubName: string
  hubId: string
  appUrl: string
  repoContent: string
  repoSlots: string
  clientId: string
  clientSecret: string
  stagingHost: string
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
  appUrl: 'http://localhost:3000',
  repoContent: '',
  repoSlots: '',
  clientId: '',
  clientSecret: '',
  stagingHost: '',
  republish: false,
}
