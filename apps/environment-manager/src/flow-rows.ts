/**
 * The Flows tab grid: one row per flow fixture, one column per hub (QL-127).
 *
 * Read-only. The question it answers is the one asked at demo-prep time —
 * "which showcase flows are on which hub, and is the one here the one I think
 * it is" — so the cell states are chosen to make a *wrong* answer visible
 * rather than to look tidy.
 *
 * Two of the five states exist only because the obvious design would lie:
 *
 *   duplicate   Labels are not unique on a hub, and the fixture matches by
 *               exact label. Picking the first match would render a green tick
 *               next to whichever flow the API happened to list first — the
 *               worst possible outcome, because it is indistinguishable from
 *               the right answer until the demo.
 *   unavailable A hub whose organization has no personal access token knows
 *               nothing about its flows. That is not "no flows here"; the
 *               fleet is fourteen hubs and most will sit in this state until
 *               someone sets a token up, so it has to read as an invitation,
 *               not a failure. It is also what a *refused* token looks like,
 *               which is why the reason travels with it.
 *
 * Pure, so every state is testable without rendering or a hub.
 */

/** One flow fixture in the repository, as the server lists them. */
import type { Column, HubUnavailable } from './hub-reads.js'

export type FlowFixture = {
  label: string
  /** Path relative to the fixtures directory, for disambiguating in the UI. */
  file: string
  /** True for `flows/local/` — pulled from a hub, not checked in. */
  local: boolean
}

/** One flow on a hub, as the server reports it. */
export type HubFlow = {
  id: string
  label: string
  /** `ENABLED | DISABLED | QUARANTINED`, or something newer. */
  status?: string
  updatedDate?: string
  /** Absent until the flow has run at least once. */
  lastRunDate?: string
}

/**
 * Why a hub's column has no data. Mirrors `FlowsFailure` on the server.
 *
 * Defined in `hub-reads.ts` now that three tables share one hub axis, and
 * re-exported here so nothing that already imports it has to move.
 */
export type { HubUnavailable } from './hub-reads.js'

/** One hub's column: either its flows, or why they could not be read. */
export type HubFlows = {
  /** The environment's `name` — the key everything else joins on. */
  name: string
  label: string
  flows?: HubFlow[]
  unavailable?: HubUnavailable
  /**
   * The hub has not answered yet.
   *
   * ⚠️ Checked **before** `flows === undefined` everywhere below, because a
   * column being read has no flows either. Reading that as "unavailable"
   * would make every column announce a missing token for the first second of
   * every visit, and would let the hide-without-a-token toggle delete columns
   * that were about to fill.
   */
  reading?: true
}

/**
 * ⚠️ Six states, where QL-127 specified five.
 *
 * `ContentFlowStatus` turned out to be `ENABLED | DISABLED | QUARANTINED`
 * (confirmed against the schema, 17 Oct 2026). Quarantine is the platform
 * switching a flow off after it misbehaved, which is a different fact from
 * someone deliberately disabling it — and at demo-prep time it is arguably the
 * most important thing this grid can tell anyone. Folding it into `disabled`
 * would hide exactly the case the tab exists to surface.
 */
/**
 * The grid's two axes, assembled client-side.
 *
 * ⚠️ No longer one response. `fixtures` comes from disk via
 * `GET /api/workforce/fixtures` and the hubs come from the config `App`
 * already holds, so both axes exist before any Workforce call — each column's
 * flows then arrive on their own (`use-hub-cells.ts`). The single fan-out this
 * replaced meant the slowest hub in the fleet decided when the grid appeared
 * at all.
 */
export type FlowsOverview = {
  fixtures: FlowFixture[]
  /**
   * Set when the fixtures could not be listed at all — a label defined in both
   * `flows/` and `flows/local/`, say. The grid has no rows in that case, and
   * the reason has to be shown rather than read as "no flows in the repo".
   */
  fixturesError?: string
}

export type CellState =
  'reading' | 'absent' | 'present' | 'disabled' | 'quarantined' | 'duplicate' | 'unavailable'

export type FlowCell = {
  hub: string
  state: CellState
  /** The matched flow, when exactly one matched. */
  flow?: HubFlow
  /** Every match when several did, so the UI can name them. */
  matches?: HubFlow[]
  unavailable?: HubUnavailable
}

export type FlowRow = {
  fixture: FlowFixture
  cells: FlowCell[]
}

/**
 * The `ContentFlowStatus` enum, as the schema gives it.
 *
 * Compared case-insensitively even though the API shouts: the comparison costs
 * nothing, and a cell silently reading as "present" because a value arrived
 * lowercased is not a failure anyone would spot.
 */
const DISABLED = 'disabled'
const QUARANTINED = 'quarantined'

/**
 * The cell state a single matched flow deserves.
 *
 * ⚠️ An unrecognised status is `present`, not an error. A fourth enum value
 * added upstream should show the flow as being there — which it is — rather
 * than blanking a column until this file catches up. The cost of that choice
 * is that a future "SUSPENDED" would read as fine for a while, which is why
 * the status itself is carried on the cell for the UI to show verbatim.
 */
export function stateOfFlow(flow: Pick<HubFlow, 'status'>): 'present' | 'disabled' | 'quarantined' {
  const status = flow.status?.trim().toLowerCase()
  if (status === DISABLED) return 'disabled'
  if (status === QUARANTINED) return 'quarantined'
  return 'present'
}

/**
 * The flows on a hub carrying exactly this label.
 *
 * Exact, and trimmed on both sides only. Not case-insensitive and not
 * normalised: `flows:push` matches by exact label too, so a looser match here
 * would show a tick for a flow that a push would refuse to update — the grid
 * has to agree with the command it is describing.
 */
export function matchesFor(flows: readonly HubFlow[], label: string): HubFlow[] {
  const wanted = label.trim()
  return flows.filter((flow) => flow.label.trim() === wanted)
}

/** One fixture against one hub. */
export function cellFor(fixture: FlowFixture, hub: HubFlows): FlowCell {
  // ⚠️ Before the `flows === undefined` check, never after it: a hub being
  // read has no flows yet, and falling through would report it as unavailable.
  if (hub.reading === true) return { hub: hub.name, state: 'reading' }

  if (hub.flows === undefined) {
    return {
      hub: hub.name,
      state: 'unavailable',
      unavailable: hub.unavailable ?? { reason: 'error' },
    }
  }

  const matches = matchesFor(hub.flows, fixture.label)
  if (matches.length === 0) return { hub: hub.name, state: 'absent' }
  if (matches.length > 1) return { hub: hub.name, state: 'duplicate', matches }

  const flow = matches[0]!
  return { hub: hub.name, state: stateOfFlow(flow), flow }
}

/**
 * The grid.
 *
 * Every fixture gets a row and every hub a cell, including hubs that could not
 * be read — a column that disappears when its token expires would make the
 * fleet look smaller than it is.
 */
export function flowRows(fixtures: readonly FlowFixture[], hubs: readonly HubFlows[]): FlowRow[] {
  return fixtures.map((fixture) => ({
    fixture,
    cells: hubs.map((hub) => cellFor(fixture, hub)),
  }))
}

/**
 * Flows on a hub that no fixture claims.
 *
 * Not a row — the grid is a view of the repository, and a per-hub stray would
 * have nothing to sit under. Reported per hub so the tab can say "and 4 others
 * on this hub", which is the honest version of a grid that would otherwise
 * imply these are the only flows that exist.
 */
export function unclaimedCount(fixtures: readonly FlowFixture[], hub: HubFlows): number {
  if (hub.flows === undefined) return 0
  const claimed = new Set(fixtures.map((fixture) => fixture.label.trim()))
  return hub.flows.filter((flow) => !claimed.has(flow.label.trim())).length
}

/** Human wording for why a column is empty, shown in the cell's title. */
export const UNAVAILABLE_EXPLANATION: Record<HubUnavailable['reason'], string> = {
  'no-token':
    'No Workforce personal access token for this hub’s organization yet, so its flows ' +
    'cannot be listed. Set one up under the hub’s credentials check.',
  denied:
    'The personal access token for this hub’s organization was refused. It may have been ' +
    'revoked, or belong to a different organization.',
  error: 'The hub’s flows could not be read. This is usually temporary — try again.',
}

/** What each cell state means, shown as the cell's title. */
export const STATE_EXPLANATION: Record<CellState, string> = {
  reading: 'Still reading this hub.',
  absent: 'Not on this hub. `pnpm flows:push` would create it.',
  present: 'On this hub, enabled.',
  disabled: 'On this hub, but switched off by someone — it will not run.',
  quarantined:
    'On this hub, but quarantined — Amplience stopped it, rather than a person disabling ' +
    'it. It will not run until it is looked at, so do not demo from it.',
  duplicate:
    'Several flows on this hub share this label. A push refuses rather than choosing, so ' +
    'this needs a human to rename or remove one.',
  unavailable: 'This hub’s flows are not readable.',
}

/** Rows whose fixture label matches a filter, for the ListFilter above the grid. */
export function filterRows(rows: readonly FlowRow[], query: string): FlowRow[] {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') return [...rows]
  return rows.filter((row) => row.fixture.label.toLowerCase().includes(wanted))
}

// ── Narrowing the hub axis ────────────────────────────────────────────────────
//
// Two controls rather than one, because the two things people want from
// fourteen columns are different questions:
//
//   "hide the ones I can't see anyway"  — a toggle. The dominant case: most of
//                                         the fleet has no token, and those
//                                         columns carry no information at all.
//   "show me just these hubs"           — a filter. Needs you to already know
//                                         which hub you want.
//
// ⚠️ Both hide columns, and hiding a column can make a row read as absent
// everywhere when it is not. {@link concealedRows} exists so the UI can say so
// rather than letting a filter quietly produce a wrong answer — the same
// failure the `duplicate` state exists to prevent, one level up.

/** Cell states that mean the flow is on that hub, however healthy it is. */
const ON_HUB: ReadonlySet<CellState> = new Set<CellState>([
  'present',
  'disabled',
  'quarantined',
  'duplicate',
])

/**
 * Whether a hub matches a query.
 *
 * Matches the hub's label and its config name, mirroring `matchesQuery` in
 * `filter-environments.ts` — the two filters sit in the same app and should not
 * disagree about what "matches" means. Substring rather than a RegExp built
 * from the query, for the same ReDoS reason given there.
 */
export function matchesHub(hub: Pick<HubFlows, 'name' | 'label'>, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return [hub.label, hub.name].some((field) => field.toLowerCase().includes(needle))
}

/** The columns to render, in their original order. */
export function filterHubs(
  hubs: readonly HubFlows[],
  query: string,
  { hideUnavailable = false }: { hideUnavailable?: boolean } = {},
): HubFlows[] {
  return hubs.filter(
    (hub) =>
      (!hideUnavailable || hub.flows !== undefined || hub.reading === true) &&
      matchesHub(hub, query),
  )
}

/**
 * Fixtures that are on a hidden hub and on none of the visible ones.
 *
 * The number that matters when columns are hidden: these rows read as "not
 * anywhere" while the grid is filtered, which is the one wrong answer this tab
 * could give someone prepping a demo. Zero when nothing is hidden, so the UI
 * can show the warning only when it is true.
 */
export function concealedRows(
  fixtures: readonly FlowFixture[],
  allHubs: readonly HubFlows[],
  visibleHubs: readonly HubFlows[],
): number {
  const visible = new Set(visibleHubs.map((hub) => hub.name))
  const hidden = allHubs.filter((hub) => !visible.has(hub.name))
  if (hidden.length === 0) return 0

  const isOn = (fixture: FlowFixture, hub: HubFlows) => ON_HUB.has(cellFor(fixture, hub).state)
  return fixtures.filter(
    (fixture) =>
      !visibleHubs.some((hub) => isOn(fixture, hub)) && hidden.some((hub) => isOn(fixture, hub)),
  ).length
}

/**
 * How many hubs have no token — what the toggle would remove.
 *
 * A hub still being read is not counted. The number drives a banner and a
 * toggle label, and one that climbed to fourteen on load and then counted
 * itself back down would be noise rather than information.
 */
export function unavailableCount(hubs: readonly HubFlows[]): number {
  return hubs.filter((hub) => hub.reading !== true && hub.flows === undefined).length
}

// ── The "Other flows" row ─────────────────────────────────────────────────────

/**
 * One hub's count of flows no fixture claims.
 *
 * ⚠️ `count` is undefined, never zero, for a hub that could not be read. "0
 * other flows" on a hub we cannot see is a statement we have no basis for, and
 * it is the kind that gets believed — it looks like a measurement.
 */
export type OtherFlowsCell = {
  hub: string
  count?: number
  unavailable?: HubUnavailable
  reading?: true
}

/**
 * The bottom row: what each hub holds that the repository does not describe.
 *
 * ⚠️ Counted against **every** fixture, not the filtered rows. "Other" means
 * "no fixture in the repository claims it", which does not change because
 * someone typed in the search box — a count that shrank as you filtered would
 * be measuring the filter rather than the hub.
 */
export function otherFlowsCells(
  fixtures: readonly FlowFixture[],
  hubs: readonly HubFlows[],
): OtherFlowsCell[] {
  return hubs.map((hub) => {
    if (hub.reading === true) return { hub: hub.name, reading: true as const }
    return hub.flows === undefined
      ? { hub: hub.name, unavailable: hub.unavailable ?? { reason: 'error' as const } }
      : { hub: hub.name, count: unclaimedCount(fixtures, hub) }
  })
}

/**
 * Whether the row is worth rendering at all.
 *
 * A row of zeroes reads as a category someone is meant to maintain, which this
 * is not — it is residue, and the honest thing when there is none is silence.
 *
 * ⚠️ But a hub still being read is not a hub with none. Shown while any column
 * is outstanding, because in practice a hub almost always carries flows the
 * repository does not describe — so the row appearing is the common case, and
 * holding it back until every hub has answered means the grid grows a row
 * underneath whatever the reader is already looking at. It disappears instead
 * on the rarer answer, which at least arrives once rather than per hub.
 */
export function hasOtherFlows(cells: readonly OtherFlowsCell[]): boolean {
  return cells.some((cell) => cell.reading === true || (cell.count ?? 0) > 0)
}

// ── Assembling the columns ────────────────────────────────────────────────────

/**
 * The hub axis, from the config the app already holds plus whatever has been
 * read so far.
 *
 * Pure on purpose: the async lives in `use-hub-cells.ts`, so the rule that
 * decides whether a column reads as *loading*, *unavailable* or *there* can be
 * tested without rendering or mocking anything. That rule is the whole point
 * of the progressive grid, and it is three lines, which is exactly the kind of
 * thing that gets quietly broken inside a component.
 */
export function flowColumns(
  hubs: readonly { name: string; label: string }[],
  columnOf: (name: string) => Column<HubFlow[]>,
): HubFlows[] {
  return hubs.map((hub) => {
    const column = columnOf(hub.name)
    const base = { name: hub.name, label: hub.label }
    if ('reading' in column) return { ...base, reading: true as const }
    if ('rows' in column) return { ...base, flows: column.rows }
    return { ...base, unavailable: column.unavailable }
  })
}
