/**
 * The read state of one hub's column, independent of what it is a column of.
 *
 * Three tables share one hub axis (ADR-0023), and all three face the same
 * problem: fourteen hubs answer at fourteen different speeds, and one slow hub
 * must not decide when anything appears. So a column is read on its own and
 * carries its own state, rather than the grid having a single "loading" flag.
 *
 * ⚠️ Kept deliberately free of both React and any one subject's shape. The
 * async lives in `use-hub-cells.ts`; the grid shapes live in `flow-rows.ts`
 * and its future siblings. This module is only the vocabulary they share, so
 * all three can be reasoned about — and tested — without rendering anything.
 */

/** Why a hub's column has no data, and will not get any without a change. */
export type HubUnavailable = {
  reason: 'no-token' | 'denied' | 'error'
  detail?: string
}

/**
 * One hub's read, in flight or finished.
 *
 * ⚠️ `reading` is not `failed`, and neither is `unavailable`. The three look
 * the same in a naive model — no data — and mean completely different things
 * to someone looking at the grid: wait, something broke, and set this up.
 * Collapsing any pair of them produces a column that lies.
 */
export type HubRead<T> =
  { status: 'reading' } | { status: 'ok'; data: T } | { status: 'failed'; error: string }

/** Every hub's read, keyed by the environment `name` the grid joins on. */
export type HubReads<T> = Record<string, HubRead<T>>

/** What a per-hub endpoint answers: the rows, or why there are none. */
export type HubPayload<T> = { unavailable?: HubUnavailable } & Partial<Record<'rows', T>>

/**
 * A column's state, resolved from its read.
 *
 * A hub with no entry at all is `reading`, not missing: the only moment that
 * happens is between the grid rendering and the request being issued, and a
 * column that flickered through "unavailable" on the way to its data would be
 * worse than one that simply says it is still working.
 */
export type Column<T> = { reading: true } | { rows: T } | { unavailable: HubUnavailable }

export function resolveColumn<T>(read: HubRead<HubPayload<T>> | undefined): Column<T> {
  if (read === undefined || read.status === 'reading') return { reading: true }

  // ⚠️ A transport failure is reported as `error`, never as `no-token`. The
  // distinction decides what the UI tells someone to do about it, and "set up
  // a token" is bad advice for a request that never reached the server.
  if (read.status === 'failed') return { unavailable: { reason: 'error', detail: read.error } }

  const { rows, unavailable } = read.data
  if (rows !== undefined) return { rows }
  return { unavailable: unavailable ?? { reason: 'error' } }
}

/** Hubs still being read, for an `aria-busy` that covers the whole axis. */
export function readingHubs(names: readonly string[], reads: HubReads<unknown>): string[] {
  return names.filter((name) => (reads[name]?.status ?? 'reading') === 'reading')
}

/**
 * Whether every hub has answered.
 *
 * Used to announce a filled grid once, rather than letting each cell announce
 * itself as it lands — fourteen columns arriving separately is fourteen
 * interruptions for anyone using a screen reader.
 */
export function allSettled(names: readonly string[], reads: HubReads<unknown>): boolean {
  return readingHubs(names, reads).length === 0
}
