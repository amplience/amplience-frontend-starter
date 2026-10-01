/**
 * The rows under "Content items", and what each one is allowed to do (ADR-0019).
 *
 * Three populations, not two. Per-set rows are the normal case; `orphaned` is
 * content the import map knows but whose fixture has left the repository; and
 * `custom` is content the map never saw, which means someone authored it in the
 * DC UI. Collapsing the last two would let a wipe labelled "tidy up strays"
 * destroy a live site's content.
 *
 * Neither `orphaned` nor `custom` can be synced: there is no source on disk to
 * sync from — that is what defines them.
 *
 * The gate on all of this is the dc-cli import map, which is machine-local. The
 * rule is not "hide the dangerous things" but:
 *
 *   anything that needs to know which fixture an item came from needs the map;
 *   anything that acts on everything doesn't.
 *
 * So with no map the per-set and scoped controls are absent, while the wholesale
 * wipes stay — which leaves wipe-and-reseed as a real recovery path for someone
 * picking up a hub that was seeded elsewhere, rather than a dead end. Sync is
 * gated not because it looks risky but because it is inherently per-item:
 * without the map it can't match source to target and creates duplicates.
 *
 * Pure, so the rules are testable without rendering anything.
 */

import type { FixtureSetInfo } from './types.js'

/** What the server reports for `GET /environments/:name/content-breakdown`. */
export type ContentBreakdown =
  | { available: true; bySet: Record<string, number>; orphaned: number; custom: number }
  | { available: false; reason: string }

export type ContentRow = {
  /** `--set <name>`, or the provenance bucket. */
  kind: 'set' | 'orphaned' | 'custom'
  /** The set's name for a set row; the bucket's name otherwise. */
  key: string
  label: string
  count: number
  canSync: boolean
  canWipe: boolean
  /**
   * Whether a wipe of this row can be undone by re-seeding from the repository.
   * False means the only copy of something may be about to go.
   */
  regenerable: boolean
  /** "3 of 6 authored locales", when the hub's list is known and narrower. */
  localeNote?: string | undefined
}

/**
 * How many of a set's authored locales this hub can actually take.
 *
 * Omitted when the hub's list is unknown, or when it covers everything the set
 * authored — a note saying "6 of 6" is noise on every row.
 */
export function localeNote(
  set: Pick<FixtureSetInfo, 'authoredLocales'>,
  hubLocales: readonly string[],
): string | undefined {
  const authored = set.authoredLocales
  if (hubLocales.length === 0 || authored.length === 0) return undefined
  const kept = authored.filter((l) => hubLocales.includes(l))
  if (kept.length === authored.length) return undefined
  return `${kept.length} of ${authored.length} locales kept`
}

/**
 * The rows to render, in the order they should appear.
 *
 * Only what the hub actually holds. A row per registered set regardless would
 * turn the panel into a catalogue of the repository rather than a description
 * of this hub, and it grows with every set added — the sets not seeded here are
 * offered through {@link seedableSets} instead, as one action rather than a row
 * each. `orphaned` and `custom` follow the same rule for the same reason: they
 * are residue, and a permanent pair of zeroes would read as categories someone
 * is meant to maintain.
 */
export function contentRows(
  breakdown: ContentBreakdown | null,
  sets: readonly FixtureSetInfo[],
  hubLocales: readonly string[] = [],
): ContentRow[] {
  if (breakdown?.available !== true) return []

  const rows: ContentRow[] = sets
    .filter((set) => (breakdown.bySet[set.name] ?? 0) > 0)
    .map((set) => ({
      kind: 'set',
      key: set.name,
      label: set.label,
      count: breakdown.bySet[set.name] ?? 0,
      canSync: true,
      canWipe: true,
      regenerable: true,
      localeNote: localeNote(set, hubLocales),
    }))

  if (breakdown.orphaned > 0) {
    rows.push({
      kind: 'orphaned',
      key: 'orphaned',
      label: 'Orphaned',
      count: breakdown.orphaned,
      canSync: false,
      canWipe: true,
      regenerable: false,
    })
  }
  if (breakdown.custom > 0) {
    rows.push({
      kind: 'custom',
      key: 'custom',
      label: 'Custom',
      count: breakdown.custom,
      canSync: false,
      canWipe: true,
      regenerable: false,
    })
  }
  return rows
}

/**
 * The sets in the repository that this hub isn't carrying yet.
 *
 * The other half of {@link contentRows}: between them every registered set is
 * either a row or an offer, so nothing is unreachable.
 *
 * Deliberately outside the provenance gate. Seeding a named set doesn't need to
 * know where anything came from — it is `hub:import:content --set <name>`, which
 * the terminal runs with no map at all — and a hub that has never been seeded
 * has no map by definition, so gating this would lock the first seed behind the
 * artefact that only seeding produces. With no breakdown every set is offered,
 * because nothing is known to be present; the gate note alongside says why the
 * counts are missing.
 */
export function seedableSets(
  breakdown: ContentBreakdown | null,
  sets: readonly FixtureSetInfo[],
): FixtureSetInfo[] {
  if (breakdown === null) return []
  if (!breakdown.available) return [...sets]
  return sets.filter((set) => (breakdown.bySet[set.name] ?? 0) === 0)
}

/** Why a row holds what it holds — shown as its title, so the buckets explain themselves. */
export const ROW_EXPLANATION: Record<ContentRow['kind'], string> = {
  set: 'Seeded from this fixture set, which is still in the repository.',
  orphaned:
    'Seeded from a fixture that has since left the repository — a retired set, a renamed ' +
    'fixture, or an older naming scheme. There is nothing on disk to sync from.',
  custom:
    'Authored on the hub rather than seeded, so the repository has no copy. ' +
    'This may be the only copy of someone’s work.',
}

/**
 * Whether the wholesale controls on the parent row are available.
 *
 * Always true: they enumerate the hub directly and need no provenance at all.
 * Named as a function so the asymmetry with the scoped controls is explicit at
 * the call site rather than implied by its absence.
 */
export const canWipeEverything = () => true

/** The one-line reason the per-set controls are missing, or null when they aren't. */
export function gateReason(breakdown: ContentBreakdown | null): string | null {
  if (breakdown === null) return null
  return breakdown.available ? null : breakdown.reason
}
