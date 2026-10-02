/**
 * The fixture-set registry — the one list of which sets exist (ADR-0019).
 *
 * Sets are listed here explicitly rather than discovered, matching ADR-0012's
 * stance on the other hand-maintained manifests: a set that exists on disk but
 * isn't listed is loudly absent everywhere at once, rather than working in some
 * places and not others.
 *
 * Every set is indexed once at module init, so lookups are map hits thereafter.
 */

import { FIXTURE_SITE_NAME } from '../config'
import type { EnrichedContentItem } from '../types'
import { indexSet, type IndexedFixtureSet } from './set'
import { anyafinnSet } from './sets/anyafinn'
import { frontendStarterSet } from './sets/frontend-starter'

/** The set a zero-config (mock) deployment serves. Defined in `../config`. */
export const DEFAULT_FIXTURE_SET = FIXTURE_SITE_NAME

const REGISTRY = new Map<string, IndexedFixtureSet>(
  [frontendStarterSet, anyafinnSet].map((set) => [set.name, indexSet(set)]),
)

/** Every registered set name, sorted. */
export const fixtureSetNames = (): readonly string[] => [...REGISTRY.keys()].sort()

/**
 * The named set, or a throw naming what is available.
 *
 * Throwing at composition rather than returning undefined is deliberate: a
 * misspelled `FIXTURE_SET` is a configuration bug, and a config bug should be
 * loud at boot rather than a not-found on every page (ADR-0010).
 */
export const resolveFixtureSet = (name: string): IndexedFixtureSet => {
  const set = REGISTRY.get(name)
  if (!set) {
    throw new Error(
      `Unknown fixture set "${name}". Available: ${fixtureSetNames().join(', ')}. ` +
        'Set FIXTURE_SET to one of those, or add the set to the registry in ' +
        'packages/content/src/mock/loader.ts.',
    )
  }
  return set
}

/**
 * Every fixture in every set.
 *
 * For guards and introspection that are about the corpus as a whole — the
 * schema drift test, id-uniqueness. Anything serving content wants one set, so
 * it goes through `resolveFixtureSet`.
 */
export const allFixtures = (): readonly EnrichedContentItem[] =>
  [...REGISTRY.values()].flatMap((set) => set.fixtures)

/** Every set, indexed — for guards that need to attribute a fixture to its set. */
export const allFixtureSets = (): readonly IndexedFixtureSet[] => [...REGISTRY.values()]
