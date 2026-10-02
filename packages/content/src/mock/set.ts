/**
 * What a fixture set is, to the mock client (ADR-0019).
 *
 * A set is a named, self-contained bundle of demo content that seeds into one
 * site namespace: every delivery key in it starts `<name>/`, and every id in it
 * derives from `<name>/<path>`, so sets never collide even on one hub.
 *
 * Set modules live in `./sets/` and are listed in `./loader`. They import their
 * fixtures statically rather than scanning disk, because the mock has to work
 * in the browser and on the edge as well as in Node.
 */

import type { EnrichedContentItem } from '../types'

/**
 * One hierarchy tree. `root` is the delivery id of the root node; `children`
 * maps each node id to its direct children, in order.
 */
export type HierarchyManifest = {
  readonly root: string
  readonly children: Readonly<Record<string, readonly string[]>>
}

/** A fixture set as its module exports it. */
export type FixtureSet = {
  /** Set name — also the site namespace and the delivery-key prefix. */
  readonly name: string
  readonly fixtures: readonly EnrichedContentItem[]
  /** Hierarchy trees, keyed by the root node's delivery key. */
  readonly hierarchies: Readonly<Record<string, HierarchyManifest>>
}

/** A set plus the lookup maps built from it. */
export type IndexedFixtureSet = FixtureSet & {
  readonly findById: (id: string) => EnrichedContentItem | undefined
  readonly findByKey: (key: string) => EnrichedContentItem | undefined
}

/** Build `id → item` and `deliveryKey → item` lookups over a set. */
export const indexSet = (set: FixtureSet): IndexedFixtureSet => {
  const byId = new Map<string, EnrichedContentItem>()
  const byKey = new Map<string, EnrichedContentItem>()
  for (const item of set.fixtures) {
    byId.set(item.id, item)
    for (const k of item.body._meta.deliveryKeys?.values ?? []) byKey.set(k.value, item)
  }
  return {
    ...set,
    findById: (id) => byId.get(id),
    findByKey: (key) => byKey.get(key),
  }
}
