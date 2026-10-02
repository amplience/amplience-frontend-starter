// What a second fixture set buys us (ADR-0019).
//
// The registry guards in loader.test.ts are structural and would pass just as
// happily with one set. These are the ones that can only fail when there are
// two: that a client built for one set can't see the other's content, and that
// the same relative key resolves to different content per set.
//
// If a third set is added, these keep working — they pick two from the registry
// rather than naming them.

import { describe, expect, it } from 'vitest'

import { isContentClientError } from '../types'
import { allFixtures, allFixtureSets, fixtureSetNames, resolveFixtureSet } from './loader'
import { makeMockContentClient } from './MockContentClient'

const [first, second] = fixtureSetNames()

describe('two sets on one registry', () => {
  it('has more than one set, so everything below is a real check', () => {
    // The point of the skeleton set: without it these tests pass vacuously.
    expect(fixtureSetNames().length).toBeGreaterThan(1)
    expect(first).toBeDefined()
    expect(second).toBeDefined()
  })

  it('resolves the same relative key to different content in each set', async () => {
    const a = await makeMockContentClient(first).getByKey<{ title: unknown }>(`${first}/homepage`)
    const b = await makeMockContentClient(second).getByKey<{ title: unknown }>(`${second}/homepage`)
    expect(a).not.toEqual(b)
  })

  it('refuses a key from another set — a client only sees its own namespace', async () => {
    const client = makeMockContentClient(first)
    await expect(client.getByKey(`${second}/homepage`)).rejects.toSatisfy(
      (e: unknown) => isContentClientError(e) && e.kind === 'not-found',
    )
  })

  it('scopes listBySchema to the set, so one site never lists the other’s items', async () => {
    // Both sets carry a locale selector. Unscoped, this would return both.
    const schema = 'https://quadratic.amplience.com/v2/content/locale-selector'
    const inCorpus = allFixtures().filter((f) => f.body._meta.schema === schema)
    expect(inCorpus.length).toBeGreaterThan(1)

    for (const name of fixtureSetNames()) {
      const listed = await makeMockContentClient(name).listBySchema(schema)
      const own = resolveFixtureSet(name).fixtures.filter((f) => f.body._meta.schema === schema)
      expect(listed).toHaveLength(own.length)
    }
  })

  it('keeps ids disjoint between sets', () => {
    // Derived from `<set>/<path>`, so the same relative path in two sets lands
    // on different ids — which is what lets both seed to one hub.
    const byId = new Map<string, string>()
    for (const set of allFixtureSets()) {
      for (const f of set.fixtures) {
        expect(
          byId.get(f.id),
          `${f.id} is in both ${byId.get(f.id)} and ${set.name}`,
        ).toBeUndefined()
        byId.set(f.id, set.name)
      }
    }
  })

  it('gives each set its own hierarchy, addressed under its own prefix', async () => {
    // A set may have none (bare-bones), but the check is vacuous unless two do.
    const withHierarchies = fixtureSetNames().filter(
      (n) => Object.keys(resolveFixtureSet(n).hierarchies).length > 0,
    )
    expect(withHierarchies.length).toBeGreaterThan(1)

    for (const name of withHierarchies) {
      const keys = Object.keys(resolveFixtureSet(name).hierarchies)
      for (const key of keys) expect(key.startsWith(`${name}/`)).toBe(true)

      // And the other set's client can't reach it.
      const other = fixtureSetNames().find((n) => n !== name)
      if (other === undefined) continue
      const firstKey = keys[0]
      if (firstKey === undefined) continue
      await expect(makeMockContentClient(other).getHierarchy(firstKey)).rejects.toSatisfy(
        (e: unknown) => isContentClientError(e) && e.kind === 'not-found',
      )
    }
  })
})
