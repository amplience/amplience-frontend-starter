import { useCallback, useEffect, useMemo, useState } from 'react'

import { api } from '../api.js'
import { FILTER_MIN_ITEMS } from '../filter-environments.js'
import {
  ACTION_EXPLANATION,
  ACTION_GLYPH,
  ACTION_LABEL,
  cellDisplay,
  isConfirmable,
  offerFor,
  type CellAction,
  type CellOpState,
} from '../flow-actions.js'
import {
  concealedRows,
  filterHubs,
  filterRows,
  flowRows,
  hasOtherFlows,
  otherFlowsCells,
  STATE_EXPLANATION,
  UNAVAILABLE_EXPLANATION,
  unavailableCount,
  type CellState,
  type FlowCell,
  type FlowsOverview,
  type HubFlows,
  type OtherFlowsCell,
} from '../flow-rows.js'
import { addEntry, entryFromError, entryFromResult, type OpEntry } from '../op-log.js'
import { ConfirmFlowOp, type ConfirmableOp, type PendingOp } from './ConfirmFlowOp.js'
import { ListFilter } from './ListFilter.js'
import { OpLogDrawer } from './OpLogDrawer.js'

/**
 * The Flows tab: every flow fixture as a row, every hub as a column (QL-127).
 *
 * Read-only on purpose — the per-cell push and sync actions are QL-162. What
 * this answers is the demo-prep question, "is the flow I am about to show
 * actually on the hub I am about to show it on, and is it the one I think it
 * is".
 *
 * All the grid logic lives in `flow-rows.ts`, which is pure and tested. This
 * file is markup and one fetch.
 */

/** The glyph for each state. Never colour alone — the letter carries it too. */
const CELL_GLYPH: Record<CellState, string> = {
  present: '✓',
  absent: '·',
  disabled: '⏸',
  quarantined: '⚠',
  duplicate: '⧉',
  unavailable: '–',
}

/** Short text beside the glyph, so the grid is readable without the legend. */
const CELL_LABEL: Record<CellState, string> = {
  present: 'On hub',
  absent: 'Not there',
  disabled: 'Disabled',
  quarantined: 'Quarantined',
  duplicate: 'Duplicate',
  unavailable: 'No token',
}

/** `2026-10-16T19:24:05Z` → `16 Oct`, or "Never". */
function shortDate(iso: string | undefined): string {
  if (iso === undefined) return 'Never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function cellTitle(cell: FlowCell): string {
  if (cell.state === 'unavailable') {
    const reason = cell.unavailable?.reason ?? 'error'
    const detail = cell.unavailable?.detail
    return UNAVAILABLE_EXPLANATION[reason] + (detail === undefined ? '' : `\n\n${detail}`)
  }
  if (cell.state === 'duplicate') {
    const ids = (cell.matches ?? []).map((flow) => flow.id).join('\n')
    return `${STATE_EXPLANATION.duplicate}\n\n${ids}`
  }
  const flow = cell.flow
  if (flow === undefined) return STATE_EXPLANATION[cell.state]
  return [
    STATE_EXPLANATION[cell.state],
    '',
    `Updated ${shortDate(flow.updatedDate)}`,
    `Last run ${shortDate(flow.lastRunDate)}`,
    flow.status === undefined ? '' : `Status ${flow.status}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * The buttons in one cell.
 *
 * ⚠️ Disabled while *any* operation on this cell is in flight, not just the
 * one that was clicked: push and remove on the same cell are contradictory,
 * and the hub is being mutated either way. The server refuses a repeat too —
 * a guard that exists only here is not a guard.
 */
function CellActions({
  cell,
  busy,
  onPick,
}: {
  cell: FlowCell
  busy: boolean
  onPick: (action: CellAction) => void
}) {
  const offer = offerFor(cell.state)
  if (offer.actions.length === 0) return null

  return (
    <span className="flow-cell__actions">
      {offer.actions.map((action) => (
        <button
          key={action}
          type="button"
          className={`btn--icon-only flow-cell__btn flow-cell__btn--${action}`}
          disabled={busy}
          title={`${ACTION_LABEL[action]} — ${ACTION_EXPLANATION[action]}`}
          aria-label={`${ACTION_LABEL[action]} ${cell.hub}`}
          onClick={() => onPick(action)}
        >
          <span aria-hidden="true">{ACTION_GLYPH[action]}</span>
        </button>
      ))}
    </span>
  )
}

function Cell({
  cell,
  op,
  onPick,
}: {
  cell: FlowCell
  op?: CellOpState
  onPick: (action: CellAction) => void
}) {
  const display = cellDisplay(CELL_GLYPH[cell.state], CELL_LABEL[cell.state], op)
  return (
    <td
      className={`flow-grid__cell flow-grid__cell--${cell.state}${op === undefined ? '' : ` flow-grid__cell--op-${op}`}`}
      title={cellTitle(cell)}
      aria-busy={op === 'running'}
    >
      <span className="flow-cell">
        <span className="flow-cell__glyph" aria-hidden="true">
          {display.glyph}
        </span>
        <span className="flow-cell__state">{display.label}</span>
        {/* Only meaningful once there is a flow to date; "Never" is a real
            answer for one that has been pushed but never triggered. */}
        {cell.flow !== undefined && (
          <span className="flow-cell__meta">ran {shortDate(cell.flow.lastRunDate)}</span>
        )}
        <CellActions cell={cell} busy={op === 'running'} onPick={onPick} />
      </span>
    </td>
  )
}

/** The column header. Just the hub — the unclaimed count has its own row. */
function HubHeader({ hub }: { hub: HubFlows }) {
  return (
    <th scope="col" className="flow-grid__hub">
      <span className="flow-grid__hub-label">{hub.label}</span>
    </th>
  )
}

/**
 * One cell of the "Other flows" row.
 *
 * Shows a dash, not a zero, for a hub that could not be read: "0 other flows"
 * there would be a measurement we never took, and it reads like one we did.
 */
function OtherCell({ cell }: { cell: OtherFlowsCell }) {
  if (cell.count === undefined) {
    const reason = cell.unavailable?.reason ?? 'error'
    return (
      <td
        className="flow-grid__cell flow-grid__cell--unavailable"
        title={UNAVAILABLE_EXPLANATION[reason]}
      >
        <span className="flow-cell__state">–</span>
      </td>
    )
  }
  return (
    <td
      className={`flow-grid__cell flow-grid__other${cell.count === 0 ? ' flow-grid__other--none' : ''}`}
      title={
        cell.count === 0
          ? 'Every flow on this hub is described by a fixture in the repository.'
          : `${cell.count} flow${cell.count === 1 ? '' : 's'} on this hub that no fixture in the repository claims — authored on the hub, or pulled from somewhere else.`
      }
    >
      <span className="flow-cell__count">{cell.count}</span>
    </td>
  )
}

export function FlowsTab() {
  const [data, setData] = useState<FlowsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hubQuery, setHubQuery] = useState('')
  const [hideUnavailable, setHideUnavailable] = useState(false)
  /** Per-cell operation state, keyed `hub\u0000label`. */
  const [ops, setOps] = useState<Record<string, CellOpState>>({})
  const [pending, setPending] = useState<ConfirmableOp | null>(null)
  const [log, setLog] = useState<OpEntry[]>([])

  /**
   * Re-read the whole grid.
   *
   * Called on mount and after every successful operation. Deliberately the
   * whole thing rather than the one cell: installing an extension changes what
   * every other row on that hub can resolve against, so patching a single cell
   * from the response would leave the rest of the column describing a hub that
   * no longer exists.
   */
  const refresh = useCallback(async () => {
    try {
      setData(await api.flows())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the flows.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const allHubs = useMemo(() => data?.hubs ?? [], [data])

  // Hiding the input must never leave a filter silently applied — the same
  // guard App.tsx uses, for the same reason: the count can drop below the
  // threshold while a query is still set.
  const showHubFilter = allHubs.length >= FILTER_MIN_ITEMS
  const hubFilter = showHubFilter ? hubQuery : ''
  const hubs = useMemo(
    () => filterHubs(allHubs, hubFilter, { hideUnavailable }),
    [allHubs, hubFilter, hideUnavailable],
  )

  const rows = useMemo(() => (data === null ? [] : flowRows(data.fixtures, hubs)), [data, hubs])
  const showFilter = rows.length >= FILTER_MIN_ITEMS
  const filter = showFilter ? query : ''
  const visible = useMemo(() => filterRows(rows, filter), [rows, filter])

  // ⚠️ Against every fixture, not the filtered rows: "other" means "no fixture
  // in the repository claims it", which does not change when someone types in
  // the search box.
  const otherCells = useMemo(
    () => (data === null ? [] : otherFlowsCells(data.fixtures, hubs)),
    [data, hubs],
  )

  const unavailable = unavailableCount(allHubs)
  const withoutToken = allHubs.filter((hub) => hub.unavailable?.reason === 'no-token').length
  // ⚠️ Measured against the *unfiltered* fleet: the number of rows the hub
  // filter has turned into a lie by hiding the only hub they are on.
  const concealed = useMemo(
    () => (data === null ? 0 : concealedRows(data.fixtures, allHubs, hubs)),
    [data, allHubs, hubs],
  )

  const cellKey = (hub: string, label: string) => `${hub}\u0000${label}`

  /**
   * Run one operation and fold the result into the log.
   *
   * ⚠️ Re-reads the whole grid afterwards rather than patching the cell from
   * the response. The operation may have changed more than the cell that was
   * clicked — installing an extension changes what every other row on that hub
   * can resolve against — and a grid that disagrees with the hub is the one
   * thing this tab must never be.
   */
  const run = async (op: PendingOp, confirm?: string) => {
    const key = cellKey(op.hub, op.label)
    setOps((current) => ({ ...current, [key]: 'running' }))
    const at = Date.now()
    try {
      const result = await api.flowOp(op.action, {
        hub: op.hub,
        label: op.label,
        ...(confirm === undefined ? {} : { confirm }),
      })
      setLog((current) => addEntry(current, entryFromResult(op, result, at)))
      setOps((current) => ({ ...current, [key]: result.ok ? 'done' : 'failed' }))
      if (result.ok) {
        await refresh()
        // ⚠️ The tick has to be *given back* once the grid has re-read, or it
        // sits on the cell forever and hides the state glyph underneath it.
        // Invisible until QL-165: push lands on `present`, whose own glyph is
        // also `✓`, and sync starts and ends there — so the lie only showed
        // when an action changed the glyph, which disable is the first to do.
        setOps((current) =>
          Object.fromEntries(Object.entries(current).filter(([cell]) => cell !== key)),
        )
      }
    } catch (err) {
      // A refused request still reaches here with the server's message, since
      // `request` throws it rather than returning it.
      setLog((current) => addEntry(current, entryFromError(op, err, at)))
      setOps((current) => ({ ...current, [key]: 'failed' }))
    }
  }

  /**
   * Sync and remove ask first; push, enable and disable go straight through.
   *
   * The split is by what the action costs if it was a mistake, not by how much
   * it changes: enable and disable each undo the other from the same cell, and
   * a push is undone by a remove. Only the two that can lose something — a
   * hub-local edit, a flow and its run history — stop to ask.
   */
  const pick = (hub: HubFlows, label: string, action: CellAction) => {
    const op: PendingOp = { action, hub: hub.name, hubLabel: hub.label, label }
    if (isConfirmable(action)) {
      setPending({ ...op, action })
      return
    }
    void run(op)
  }

  if (error !== null) {
    return (
      <div className="env-list">
        <div className="banner banner--error">
          <strong>Error:</strong> {error}
        </div>
      </div>
    )
  }

  if (data === null) return <p className="loading">Loading flows…</p>

  return (
    <div className="env-list">
      {/* Said once above the grid rather than fourteen times inside it. Most
          hubs will sit here until someone sets a token up, and a wall of
          identical cells reads as breakage rather than as a setup step.
          Suppressed once they are hidden — the toggle's own label says it. */}
      {withoutToken > 0 && !hideUnavailable && (
        <p className="env-card__description">
          {withoutToken} of {allHubs.length} hubs have no Workforce personal access token yet, so
          their flows cannot be listed. Add one from a hub’s credentials check in{' '}
          <strong>Content Sources</strong>; one token covers every hub in its organization.
        </p>
      )}

      {/* ── The hub axis ────────────────────────────────────────────────────
          Deliberately not a twin of the filter above. That one narrows rows and
          belongs with the section title; these narrow columns, so they sit
          against the grid they act on. Two different controls for two different
          questions: the toggle for "hide the ones I can't see anyway", which is
          most of the fleet, and the filter for "show me this hub", which needs
          you to know its name already. */}
      {rows.length > 0 && allHubs.length > 1 && (
        <div className="flow-grid__toolbar">
          <span className="flow-grid__toolbar-label" id="flows-hub-axis">
            Hubs
          </span>

          {unavailable > 0 && (
            <label className="flow-grid__toggle">
              <input
                type="checkbox"
                checked={hideUnavailable}
                onChange={(e) => setHideUnavailable(e.target.checked)}
              />
              Hide {unavailable} without a token
            </label>
          )}

          {showHubFilter && (
            <ListFilter
              label="Filter hubs"
              placeholder="Filter hubs…"
              noun="hubs"
              value={hubQuery}
              onChange={setHubQuery}
              resultCount={hubs.length}
              totalCount={allHubs.length}
            />
          )}
        </div>
      )}

      <div className="env-list__header">
        <h3 className="env-list__title">Flows</h3>
        {showFilter && (
          <ListFilter
            label="Filter flows"
            placeholder="Filter flows…"
            noun="flows"
            value={query}
            onChange={setQuery}
            resultCount={visible.length}
            totalCount={rows.length}
          />
        )}
      </div>

      {data.fixturesError !== undefined && (
        <div className="banner banner--error">
          <strong>Fixtures could not be listed:</strong> {data.fixturesError}
        </div>
      )}

      {/* ⚠️ The one wrong answer this tab could give: a row reading "not
          anywhere" because the hub it is on is hidden. Worth interrupting for,
          because nothing else on screen contradicts it. */}
      {concealed > 0 && (
        <p className="banner banner--warn flow-grid__concealed">
          {concealed} {concealed === 1 ? 'flow is' : 'flows are'} on a hidden hub and on none of the{' '}
          {hubs.length} shown — {concealed === 1 ? 'its row reads' : 'their rows read'} as absent
          while this filter is on.
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setHubQuery('')
              setHideUnavailable(false)
            }}
          >
            Show all hubs
          </button>
        </p>
      )}

      {hubs.length === 0 && allHubs.length > 0 && (
        <p className="empty-state empty-state--filter">
          No hubs match this filter, so there is nothing to compare against.
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setHubQuery('')
              setHideUnavailable(false)
            }}
          >
            Show all {allHubs.length} hubs
          </button>
        </p>
      )}

      {rows.length === 0 && data.fixturesError === undefined && (
        <p className="env-card__description">
          No flow fixtures in <code>packages/hub-management/flows/</code>. Pull one from a hub with{' '}
          <code>pnpm flows:pull &lt;flowId&gt;</code>.
        </p>
      )}

      {rows.length > 0 && hubs.length > 0 && (
        <div className="flow-grid__scroll">
          <table className="flow-grid">
            <caption className="visually-hidden">
              Flow fixtures in the repository against the hubs they are installed on
            </caption>
            <thead>
              <tr>
                <th scope="col" className="flow-grid__fixture">
                  <div>
                    <span>Flow</span>
                    <span>Hub:</span>
                  </div>
                </th>
                {hubs.map((hub) => (
                  <HubHeader key={hub.name} hub={hub} />
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.fixture.file}>
                  <th scope="row" className="flow-grid__fixture">
                    <span className="flow-grid__fixture-label">{row.fixture.label}</span>
                    {/* A locally-pulled fixture is not in the repository, so
                        anyone reading this grid as "what we ship" needs to know
                        which rows only exist on this machine. */}
                    {row.fixture.local && (
                      <span className="badge" title="In flows/local/ — not checked in.">
                        local
                      </span>
                    )}
                  </th>
                  {row.cells.map((cell) => (
                    <Cell
                      key={cell.hub}
                      cell={cell}
                      {...(ops[cellKey(cell.hub, row.fixture.label)] === undefined
                        ? {}
                        : { op: ops[cellKey(cell.hub, row.fixture.label)] })}
                      onPick={(action) => {
                        const hub = hubs.find((h) => h.name === cell.hub)
                        if (hub !== undefined) pick(hub, row.fixture.label, action)
                      }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>

            {/* A summary of the columns rather than another fixture, so it
                lives in the foot: these flows have no row of their own,
                because the grid is a view of the repository and they are not
                in it. Hidden entirely when every hub holds none — a permanent
                row of zeroes reads as a category to maintain. */}
            {hasOtherFlows(otherCells) && (
              <tfoot>
                <tr>
                  <th scope="row" className="flow-grid__fixture flow-grid__other-label">
                    Other flows
                    <span className="flow-grid__other-hint">not in the repository</span>
                  </th>
                  {otherCells.map((cell) => (
                    <OtherCell key={cell.hub} cell={cell} />
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {visible.length === 0 && rows.length > 0 && filter.trim() !== '' && (
        <p className="empty-state empty-state--filter">
          No flows match “{filter.trim()}”.
          <button className="btn btn--sm btn--ghost" onClick={() => setQuery('')}>
            Clear filter
          </button>
        </p>
      )}

      {/* Shared across the tab rather than owned by this table — the listener
          and extension tables will add to the same log. */}
      <OpLogDrawer log={log} onClear={() => setLog([])} />

      {pending !== null && (
        <ConfirmFlowOp
          op={pending}
          onCancel={() => setPending(null)}
          onConfirm={(confirm) => {
            const op = pending
            setPending(null)
            void run(op, confirm)
          }}
        />
      )}
    </div>
  )
}
