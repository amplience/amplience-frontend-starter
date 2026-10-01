/**
 * Where each item on a hub came from (ADR-0019).
 *
 * Three populations, not two, and keeping the last two apart is the whole point:
 *
 *   per set   the dc-cli map ties it to a fixture that is on disk now
 *   orphaned  the map knows it, but its source isn't on disk any more —
 *             a retired set, a renamed fixture, an older naming scheme
 *   custom    the map never saw it — authored in the DC UI
 *
 * Collapse `orphaned` into `custom` and retiring a set silently moves its hub
 * content into the bucket labelled "things nobody is using", where a wipe would
 * destroy a live site's content while presenting itself as tidying up strays.
 *
 * The evidence is dc-cli's import map, which records `sourceId → hubItemId` for
 * everything it created. That map is machine-local, so a machine that didn't do
 * the seeding can't classify anything — callers must treat an absent map as
 * "unknown", never as "all custom". See `hub-import-map-portability.md`.
 *
 * Plain ESM so `node scripts/hub-wipe.mjs` can import it without a TS loader;
 * `provenance.d.mts` gives the .ts test real types.
 */

/**
 * Bucket a hub's items by where they came from.
 *
 * @param hubItems items as the Management API returns them (`{ id, label }` is
 *   all this needs); pass both active and archived, since an archived item still
 *   holds its delivery key
 * @param contentItemPairs the map's `contentItems`, as `[sourceId, hubItemId]`
 * @param sets `{ name, ids }` per set on disk, ids being the fixtures' own ids
 */
export const classifyHubItems = (hubItems, contentItemPairs, sets) => {
  const sourceOf = new Map()
  for (const [sourceId, hubId] of contentItemPairs) sourceOf.set(hubId, sourceId)

  const setOfSource = new Map()
  for (const set of sets) for (const id of set.ids) setOfSource.set(id, set.name)

  const bySet = new Map(sets.map((s) => [s.name, []]))
  const orphaned = []
  const custom = []

  for (const item of hubItems) {
    const sourceId = sourceOf.get(item.id)
    if (sourceId === undefined) {
      custom.push(item)
      continue
    }
    const setName = setOfSource.get(sourceId)
    if (setName === undefined) {
      orphaned.push(item)
      continue
    }
    bySet.get(setName).push(item)
  }

  return { bySet, orphaned, custom }
}

/** Counts only — what a UI needs without carrying every item across the wire. */
export const summarise = ({ bySet, orphaned, custom }) => ({
  bySet: Object.fromEntries([...bySet].map(([name, items]) => [name, items.length])),
  orphaned: orphaned.length,
  custom: custom.length,
  total:
    [...bySet.values()].reduce((n, items) => n + items.length, 0) + orphaned.length + custom.length,
})

/**
 * The items a `--set` / `--custom` / `--orphaned` wipe would act on.
 *
 * Returns `undefined` for an unknown set so the caller can say so, rather than
 * silently wiping nothing and reporting success.
 */
export const selectForWipe = (classified, selector) => {
  if (selector.custom === true) return classified.custom
  if (selector.orphaned === true) return classified.orphaned
  if (typeof selector.set === 'string') return classified.bySet.get(selector.set)
  return undefined
}

/**
 * Whether a selection can be put back from the repository.
 *
 * This is what decides whether a wipe just runs or stops to be confirmed: a set
 * can be reseeded from disk, while `custom` may be the only copy of someone's
 * hand-authored work and `orphaned`'s originating fixtures are gone.
 */
export const isRegenerable = (selector) => typeof selector.set === 'string'
