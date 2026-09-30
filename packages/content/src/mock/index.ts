/** Barrel for the mock adapter. See `./MockContentClient` for usage. */

export { makeFailingContentClient } from './FailingContentClient'
export { makeMockContentClient } from './MockContentClient'
export {
  DEFAULT_FIXTURE_SET,
  allFixtureSets,
  allFixtures,
  fixtureSetNames,
  resolveFixtureSet,
} from './loader'
export type { FixtureSet, HierarchyManifest, IndexedFixtureSet } from './set'
