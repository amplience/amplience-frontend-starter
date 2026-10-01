import { describe, expect, it } from 'vitest'

// The classifier is plain ESM (.mjs) shared with the wipe script; import it
// directly so the test exercises the exact code a destructive run uses.
import { classifyHubItems, isRegenerable, selectForWipe, summarise } from './provenance.mjs'

const item = (id: string, label?: string) => ({ id, label: label ?? id })

/** A hub carrying two seeded sets, a retired set's leftovers, and hand-authored content. */
const scenario = () => {
  const hubItems = [
    item('hub-fs-1'),
    item('hub-fs-2'),
    item('hub-af-1'),
    item('hub-gone-1', 'Retired set — hero'),
    item('hub-authored-1', 'ZTest - Brand'),
  ]
  const pairs: [string, string][] = [
    ['src-fs-1', 'hub-fs-1'],
    ['src-fs-2', 'hub-fs-2'],
    ['src-af-1', 'hub-af-1'],
    // Seeded once from a set that has since left the repo.
    ['src-gone-1', 'hub-gone-1'],
    // hub-authored-1 is deliberately absent: the map never saw it.
  ]
  const sets = [
    { name: 'frontend-starter', ids: new Set(['src-fs-1', 'src-fs-2']) },
    { name: 'anyafinn', ids: new Set(['src-af-1']) },
  ]
  return { hubItems, pairs, sets }
}

describe('classifyHubItems', () => {
  it('attributes each item to the set whose fixture is still on disk', () => {
    const { hubItems, pairs, sets } = scenario()
    const { bySet } = classifyHubItems(hubItems, pairs, sets)

    expect(bySet.get('frontend-starter')?.map((i) => i.id)).toEqual(['hub-fs-1', 'hub-fs-2'])
    expect(bySet.get('anyafinn')?.map((i) => i.id)).toEqual(['hub-af-1'])
  })

  it('separates a retired set’s content from hand-authored content', () => {
    // The distinction this module exists for. Collapsed, a `--custom` wipe would
    // destroy a live site's content while claiming to tidy up strays.
    const { hubItems, pairs, sets } = scenario()
    const { orphaned, custom } = classifyHubItems(hubItems, pairs, sets)

    expect(orphaned.map((i) => i.id)).toEqual(['hub-gone-1'])
    expect(custom.map((i) => i.id)).toEqual(['hub-authored-1'])
  })

  it('gives every item exactly one bucket', () => {
    const { hubItems, pairs, sets } = scenario()
    const c = classifyHubItems(hubItems, pairs, sets)
    expect(summarise(c).total).toBe(hubItems.length)
  })

  it('counts archived items apart rather than in a bucket', () => {
    // A wipe archives and prunes its map entries, so what it removed matches no
    // map entry — the definition of `custom`. Counted there, a completed wipe of
    // 142 items would read as 142 items moving into `custom` rather than going.
    const hubItems = [
      { id: 'hub-fs-1', label: 'live', status: 'ACTIVE' },
      { id: 'hub-wiped-1', label: 'archived by an earlier wipe', status: 'ARCHIVED' },
    ]
    const sets = [{ name: 'frontend-starter', ids: new Set(['src-fs-1']) }]
    const counts = summarise(classifyHubItems(hubItems, [['src-fs-1', 'hub-fs-1']], sets))

    expect(counts.bySet['frontend-starter']).toBe(1)
    expect(counts.custom).toBe(0)
    expect(counts.total).toBe(1)
    expect(counts.archived).toBe(1)
  })

  it('treats an item with no status as live', () => {
    // The common case, and the safe reading when the caller didn't say.
    const { hubItems, pairs, sets } = scenario()
    expect(summarise(classifyHubItems(hubItems, pairs, sets)).archived).toBe(0)
  })

  it('still classifies archived items, because a wipe has to reach them', () => {
    // An older wipe (or the DC UI) archived without stripping delivery keys, and
    // those stay reserved hub-wide until something takes them off.
    const hubItems = [{ id: 'hub-af-1', status: 'ARCHIVED' }]
    const sets = [{ name: 'anyafinn', ids: new Set(['src-af-1']) }]
    const c = classifyHubItems(hubItems, [['src-af-1', 'hub-af-1']], sets)
    expect(c.bySet.get('anyafinn')?.map((i) => i.id)).toEqual(['hub-af-1'])
  })

  it('lists a set with nothing on the hub as empty, not missing', () => {
    const { hubItems, pairs } = scenario()
    const sets = [
      { name: 'frontend-starter', ids: new Set(['src-fs-1', 'src-fs-2']) },
      { name: 'not-seeded-yet', ids: new Set(['src-new-1']) },
    ]
    const { bySet } = classifyHubItems(hubItems, pairs, sets)
    expect(bySet.get('not-seeded-yet')).toEqual([])
  })

  it('counts everything as custom when the map is empty', () => {
    // What a machine that didn't do the seeding would see. The caller must treat
    // this as "unknown" and refuse to act — see hub-import-map-portability.md.
    const { hubItems, sets } = scenario()
    const { custom, orphaned } = classifyHubItems(hubItems, [], sets)
    expect(custom).toHaveLength(hubItems.length)
    expect(orphaned).toEqual([])
  })

  it('ignores map entries for items no longer on the hub', () => {
    const { pairs, sets } = scenario()
    const c = classifyHubItems([item('hub-fs-1')], pairs, sets)
    expect(summarise(c).total).toBe(1)
  })
})

describe('selectForWipe', () => {
  const classified = () => {
    const { hubItems, pairs, sets } = scenario()
    return classifyHubItems(hubItems, pairs, sets)
  }

  it('scopes to one set', () => {
    expect(selectForWipe(classified(), { set: 'anyafinn' })?.map((i) => i.id)).toEqual(['hub-af-1'])
  })

  it('scopes to custom and to orphaned separately', () => {
    expect(selectForWipe(classified(), { custom: true })?.map((i) => i.id)).toEqual([
      'hub-authored-1',
    ])
    expect(selectForWipe(classified(), { orphaned: true })?.map((i) => i.id)).toEqual([
      'hub-gone-1',
    ])
  })

  it('returns undefined for an unknown set rather than selecting nothing', () => {
    // Wiping nothing and reporting success would read as "already clean".
    expect(selectForWipe(classified(), { set: 'no-such-set' })).toBeUndefined()
  })

  it('returns undefined when no selector is given', () => {
    expect(selectForWipe(classified(), {})).toBeUndefined()
  })
})

describe('isRegenerable', () => {
  it('is true only for a set, which can be reseeded from disk', () => {
    expect(isRegenerable({ set: 'anyafinn' })).toBe(true)
    expect(isRegenerable({ custom: true })).toBe(false)
    expect(isRegenerable({ orphaned: true })).toBe(false)
  })
})
