import { describe, expect, it } from 'vitest'

import {
  cellFor,
  concealedRows,
  filterHubs,
  filterRows,
  flowColumns,
  flowRows,
  hasOtherFlows,
  isRunnable,
  matchesFor,
  matchesHub,
  NOT_RUNNING,
  otherFlowsCells,
  STATE_EXPLANATION,
  stateOfFlow,
  UNAVAILABLE_EXPLANATION,
  unavailableCount,
  unclaimedCount,
  type FlowFixture,
  type HubFlow,
  type HubFlows,
} from './flow-rows.js'

const fixture = (label: string, overrides: Partial<FlowFixture> = {}): FlowFixture => ({
  label,
  file: `${label.toLowerCase().replace(/\s+/g, '-')}.json`,
  local: false,
  ...overrides,
})

const onHub = (label: string, overrides: Partial<HubFlow> = {}): HubFlow => ({
  id: `id-${label}`,
  label,
  status: 'ENABLED',
  updatedDate: '2026-10-01T09:00:00Z',
  ...overrides,
})

const hub = (name: string, flows: HubFlow[]): HubFlows => ({ name, label: name, flows })

const LOCALIZE = 'Localize content item'

describe('stateOfFlow', () => {
  it('maps the three values ContentFlowStatus actually has', () => {
    expect(stateOfFlow({ status: 'ENABLED' })).toBe('present')
    expect(stateOfFlow({ status: 'DISABLED' })).toBe('disabled')
    expect(stateOfFlow({ status: 'QUARANTINED' })).toBe('quarantined')
  })

  // Quarantine is the platform stopping a flow, not a person disabling it. The
  // two need different words in front of someone prepping a demo.
  it('keeps quarantined distinct from disabled', () => {
    expect(stateOfFlow({ status: 'QUARANTINED' })).not.toBe(stateOfFlow({ status: 'DISABLED' }))
  })

  it('does not care about case or stray space', () => {
    expect(stateOfFlow({ status: ' disabled ' })).toBe('disabled')
    expect(stateOfFlow({ status: 'Quarantined' })).toBe('quarantined')
  })

  // A fourth value added upstream should show the flow as being there — which
  // it is — rather than blanking a column until this file catches up.
  it('treats an unknown or missing status as present', () => {
    expect(stateOfFlow({ status: 'SUSPENDED' })).toBe('present')
    expect(stateOfFlow({})).toBe('present')
  })
})

describe('isRunnable', () => {
  it('is false for both ways a flow can be stopped', () => {
    expect(isRunnable({ status: 'ENABLED' })).toBe(true)
    expect(isRunnable({ status: 'DISABLED' })).toBe(false)
    expect(isRunnable({ status: 'QUARANTINED' })).toBe(false)
  })

  it('agrees with NOT_RUNNING', () => {
    for (const status of ['DISABLED', 'QUARANTINED']) {
      expect(NOT_RUNNING.has(stateOfFlow({ status }))).toBe(true)
    }
    expect(NOT_RUNNING.has(stateOfFlow({ status: 'ENABLED' }))).toBe(false)
  })
})

describe('matchesFor', () => {
  it('matches the exact label, ignoring only surrounding space', () => {
    const flows = [onHub(LOCALIZE), onHub(` ${LOCALIZE} `), onHub('Something else')]
    expect(matchesFor(flows, LOCALIZE)).toHaveLength(2)
  })

  // Looser matching would tick a cell for a flow that `flows:push` would then
  // refuse to update — the grid has to agree with the command it describes.
  it('does not match on case or partial text', () => {
    const flows = [onHub(LOCALIZE.toUpperCase()), onHub(`${LOCALIZE} v2`)]
    expect(matchesFor(flows, LOCALIZE)).toEqual([])
  })
})

describe('cellFor', () => {
  it('is absent when the hub has nothing by that label', () => {
    expect(cellFor(fixture(LOCALIZE), hub('alpha', [onHub('Other')]))).toEqual({
      hub: 'alpha',
      state: 'absent',
    })
  })

  it('is present with the matched flow when exactly one matches', () => {
    const cell = cellFor(fixture(LOCALIZE), hub('alpha', [onHub(LOCALIZE)]))
    expect(cell.state).toBe('present')
    expect(cell.flow?.id).toBe(`id-${LOCALIZE}`)
    expect(cell.flow?.updatedDate).toBe('2026-10-01T09:00:00Z')
  })

  it('is disabled when the single match is switched off', () => {
    const cell = cellFor(fixture(LOCALIZE), hub('alpha', [onHub(LOCALIZE, { status: 'DISABLED' })]))
    expect(cell.state).toBe('disabled')
    expect(cell.flow).toBeDefined()
  })

  it('is quarantined when Amplience stopped it, not a person', () => {
    const stopped = hub('alpha', [onHub(LOCALIZE, { status: 'QUARANTINED' })])
    const cell = cellFor(fixture(LOCALIZE), stopped)
    expect(cell.state).toBe('quarantined')
    // The status travels so the UI can show it verbatim rather than paraphrase.
    expect(cell.flow?.status).toBe('QUARANTINED')
  })

  it('carries lastRunDate through, including never having run', () => {
    const ran = hub('alpha', [onHub(LOCALIZE, { lastRunDate: '2026-10-16T19:24:05.314Z' })])
    expect(cellFor(fixture(LOCALIZE), ran).flow?.lastRunDate).toBe('2026-10-16T19:24:05.314Z')

    const neverRan = hub('alpha', [onHub(LOCALIZE)])
    expect(cellFor(fixture(LOCALIZE), neverRan).flow?.lastRunDate).toBeUndefined()
  })

  // The DoD case, and the reason the state exists: picking the first match
  // would render a tick indistinguishable from the right answer.
  it('is duplicate, carrying every match, when two share the label', () => {
    const twins = [onHub(LOCALIZE), { ...onHub(LOCALIZE), id: 'second' }]
    const cell = cellFor(fixture(LOCALIZE), hub('alpha', twins))
    expect(cell.state).toBe('duplicate')
    expect(cell.matches).toHaveLength(2)
    expect(cell.flow).toBeUndefined()
  })

  it('is duplicate even when both copies are disabled', () => {
    const twins = [
      onHub(LOCALIZE, { status: 'DISABLED' }),
      { ...onHub(LOCALIZE, { status: 'DISABLED' }), id: 'second' },
    ]
    expect(cellFor(fixture(LOCALIZE), hub('alpha', twins)).state).toBe('duplicate')
  })

  it('is unavailable, carrying the reason, when the hub could not be read', () => {
    const noToken: HubFlows = {
      name: 'alpha',
      label: 'Alpha',
      unavailable: { reason: 'no-token' },
    }
    expect(cellFor(fixture(LOCALIZE), noToken)).toEqual({
      hub: 'alpha',
      state: 'unavailable',
      unavailable: { reason: 'no-token' },
    })
  })

  it('falls back to a plain error when a hub has no flows and no reason', () => {
    const cell = cellFor(fixture(LOCALIZE), { name: 'alpha', label: 'Alpha' })
    expect(cell.state).toBe('unavailable')
    expect(cell.unavailable?.reason).toBe('error')
  })
})

describe('flowRows', () => {
  it('gives every fixture a row and every hub a cell', () => {
    const rows = flowRows(
      [fixture(LOCALIZE), fixture('Translate')],
      [hub('alpha', [onHub(LOCALIZE)]), hub('beta', [])],
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.cells.map((c) => c.state)).toEqual(['present', 'absent'])
    expect(rows[1]?.cells.map((c) => c.state)).toEqual(['absent', 'absent'])
  })

  // The fleet is fourteen hubs and most will have no token until someone sets
  // one up. The tab has to look like fourteen hubs, not like three.
  it('keeps a column for every hub when none of them can be read', () => {
    const fleet: HubFlows[] = Array.from({ length: 14 }, (_, i) => ({
      name: `hub-${i}`,
      label: `Hub ${i}`,
      unavailable: { reason: 'no-token' as const },
    }))
    const rows = flowRows([fixture(LOCALIZE)], fleet)
    expect(rows[0]?.cells).toHaveLength(14)
    expect(rows[0]?.cells.every((c) => c.state === 'unavailable')).toBe(true)
  })

  it('has no rows when the repository has no fixtures', () => {
    expect(flowRows([], [hub('alpha', [onHub(LOCALIZE)])])).toEqual([])
  })

  it('preserves fixture order and hub order', () => {
    const rows = flowRows([fixture('B'), fixture('A')], [hub('two', []), hub('one', [])])
    expect(rows.map((r) => r.fixture.label)).toEqual(['B', 'A'])
    expect(rows[0]?.cells.map((c) => c.hub)).toEqual(['two', 'one'])
  })
})

describe('unclaimedCount', () => {
  // Without this the grid quietly implies the fixtures are all the flows there
  // are, which at demo-prep time is exactly the wrong impression.
  it('counts a hub’s flows that no fixture claims', () => {
    const hubFlows = hub('alpha', [onHub(LOCALIZE), onHub('Hand-built'), onHub('Also theirs')])
    expect(unclaimedCount([fixture(LOCALIZE)], hubFlows)).toBe(2)
  })

  it('is zero for an unreadable hub rather than a guess', () => {
    expect(unclaimedCount([fixture(LOCALIZE)], { name: 'a', label: 'A' })).toBe(0)
  })
})

describe('filterRows', () => {
  const rows = flowRows([fixture(LOCALIZE), fixture('Translate content item')], [hub('alpha', [])])

  it('matches part of a label, ignoring case', () => {
    expect(filterRows(rows, 'LOCAL')).toHaveLength(1)
    expect(filterRows(rows, 'content item')).toHaveLength(2)
  })

  it('returns everything for an empty or blank query', () => {
    expect(filterRows(rows, '')).toHaveLength(2)
    expect(filterRows(rows, '   ')).toHaveLength(2)
  })

  it('returns nothing rather than everything when nothing matches', () => {
    expect(filterRows(rows, 'zzz')).toEqual([])
  })
})

describe('explanations', () => {
  it('has wording for every state and every unavailable reason', () => {
    const states = [
      'absent',
      'present',
      'disabled',
      'quarantined',
      'duplicate',
      'unavailable',
    ] as const
    for (const state of states) {
      expect(STATE_EXPLANATION[state]).toBeTruthy()
    }
    for (const reason of ['no-token', 'denied', 'error'] as const) {
      expect(UNAVAILABLE_EXPLANATION[reason]).toBeTruthy()
    }
  })
})

describe('matchesHub', () => {
  it('matches the label or the config name, ignoring case', () => {
    const h = { name: 'quadratic-lite', label: 'Quadratic Lite' }
    expect(matchesHub(h, 'QUADRATIC')).toBe(true)
    expect(matchesHub(h, 'lite')).toBe(true)
    expect(matchesHub(h, 'mattdemo')).toBe(false)
  })

  it('matches everything on an empty or blank query', () => {
    const h = { name: 'a', label: 'A' }
    expect(matchesHub(h, '')).toBe(true)
    expect(matchesHub(h, '   ')).toBe(true)
  })
})

describe('filterHubs', () => {
  const fleet = [
    hub('mattdemo', [onHub(LOCALIZE)]),
    hub('anyafinn', []),
    { name: 'douglas', label: 'Douglas', unavailable: { reason: 'no-token' as const } },
  ]

  it('narrows by query, keeping original order', () => {
    expect(filterHubs(fleet, 'd').map((h) => h.name)).toEqual(['mattdemo', 'douglas'])
  })

  // The dominant case at fourteen hubs: those columns carry no information.
  it('drops unreadable hubs when asked', () => {
    expect(filterHubs(fleet, '', { hideUnavailable: true }).map((h) => h.name)).toEqual([
      'mattdemo',
      'anyafinn',
    ])
  })

  it('applies both together', () => {
    expect(filterHubs(fleet, 'd', { hideUnavailable: true }).map((h) => h.name)).toEqual([
      'mattdemo',
    ])
  })

  it('returns everything by default', () => {
    expect(filterHubs(fleet, '')).toHaveLength(3)
  })
})

describe('unavailableCount', () => {
  it('counts the hubs a token would light up', () => {
    expect(
      unavailableCount([
        hub('a', []),
        { name: 'b', label: 'B', unavailable: { reason: 'no-token' } },
        { name: 'c', label: 'C', unavailable: { reason: 'denied' } },
      ]),
    ).toBe(2)
  })
})

describe('concealedRows', () => {
  const all = [hub('alpha', [onHub(LOCALIZE)]), hub('beta', [onHub('Translate')])]
  const fixtures = [fixture(LOCALIZE), fixture('Translate')]

  // The whole reason this exists: filtering columns must not turn "it is on a
  // hub" into "it is nowhere", which is the one wrong answer this tab can give.
  it('counts a fixture whose only hub is hidden', () => {
    const visible = [all[0]!]
    expect(concealedRows(fixtures, all, visible)).toBe(1)
  })

  it('is zero when nothing is hidden', () => {
    expect(concealedRows(fixtures, all, all)).toBe(0)
  })

  it('does not count a fixture that is also on a visible hub', () => {
    const everywhere = [hub('alpha', [onHub(LOCALIZE)]), hub('beta', [onHub(LOCALIZE)])]
    expect(concealedRows([fixture(LOCALIZE)], everywhere, [everywhere[0]!])).toBe(0)
  })

  it('does not count a fixture that is on no hub at all', () => {
    const none = [hub('alpha', []), hub('beta', [])]
    expect(concealedRows([fixture(LOCALIZE)], none, [none[0]!])).toBe(0)
  })

  // Disabled, quarantined and duplicate all mean "it is there" — hiding any of
  // them is just as misleading as hiding a healthy one.
  it('counts the unhealthy states too, not just present', () => {
    for (const status of ['DISABLED', 'QUARANTINED']) {
      const hidden = [hub('alpha', []), hub('beta', [onHub(LOCALIZE, { status })])]
      expect(concealedRows([fixture(LOCALIZE)], hidden, [hidden[0]!])).toBe(1)
    }
    const twins = [
      hub('alpha', []),
      hub('beta', [onHub(LOCALIZE), { ...onHub(LOCALIZE), id: 'second' }]),
    ]
    expect(concealedRows([fixture(LOCALIZE)], twins, [twins[0]!])).toBe(1)
  })

  // An unreadable hub is not evidence the flow is there, so hiding it conceals
  // nothing — otherwise the toggle would warn on every use.
  it('treats a hidden unreadable hub as concealing nothing', () => {
    const fleet = [
      hub('alpha', []),
      { name: 'beta', label: 'B', unavailable: { reason: 'no-token' as const } },
    ]
    expect(concealedRows([fixture(LOCALIZE)], fleet, [fleet[0]!])).toBe(0)
  })
})

describe('otherFlowsCells', () => {
  const fixtures = [fixture(LOCALIZE)]

  it('counts what the repository does not describe, per hub', () => {
    const fleet = [
      hub('alpha', [onHub(LOCALIZE), onHub('Hand-built'), onHub('Also theirs')]),
      hub('beta', [onHub(LOCALIZE)]),
    ]
    expect(otherFlowsCells(fixtures, fleet)).toEqual([
      { hub: 'alpha', count: 2 },
      { hub: 'beta', count: 0 },
    ])
  })

  // The distinction the row lives or dies on: "none" and "we cannot see" are
  // different answers, and only one of them is a measurement.
  it('leaves the count undefined for an unreadable hub rather than zero', () => {
    const fleet = [{ name: 'beta', label: 'B', unavailable: { reason: 'no-token' as const } }]
    const cells = otherFlowsCells(fixtures, fleet)
    expect(cells[0]).toEqual({ hub: 'beta', unavailable: { reason: 'no-token' } })
    expect(cells[0]).not.toHaveProperty('count')
  })

  it('falls back to a plain error when a hub gives no reason', () => {
    const cells = otherFlowsCells(fixtures, [{ name: 'b', label: 'B' }])
    expect(cells[0]?.unavailable?.reason).toBe('error')
  })

  it('keeps one cell per hub, in order', () => {
    const fleet = [hub('one', []), hub('two', []), hub('three', [])]
    expect(otherFlowsCells(fixtures, fleet).map((c) => c.hub)).toEqual(['one', 'two', 'three'])
  })
})

describe('hasOtherFlows', () => {
  it('is true when any hub holds something unclaimed', () => {
    expect(
      hasOtherFlows([
        { hub: 'a', count: 0 },
        { hub: 'b', count: 3 },
      ]),
    ).toBe(true)
  })

  // A permanent row of zeroes reads as a category to maintain, which it is not.
  it('is false when every readable hub holds nothing extra', () => {
    expect(
      hasOtherFlows([
        { hub: 'a', count: 0 },
        { hub: 'b', count: 0 },
      ]),
    ).toBe(false)
    expect(hasOtherFlows([])).toBe(false)
  })

  it('is false when the only hubs are unreadable', () => {
    expect(hasOtherFlows([{ hub: 'a', unavailable: { reason: 'no-token' } }])).toBe(false)
  })
})

// ── A column that has not answered yet ───────────────────────────────────────
//
// `reading` was added when the grid stopped arriving in one response. It looks
// like `unavailable` in any model that only asks "are there flows?" — both have
// none — and the difference is what the UI tells someone to do: wait, or go and
// set a token up. Every assertion below is that distinction holding somewhere
// it would otherwise be lost.

describe('a hub still being read', () => {
  const fixture = { label: 'Localise', file: 'localise.json', local: false }
  const reading = { name: 'douglas', label: 'Douglas', reading: true as const }
  const untokened = {
    name: 'mattdemo',
    label: 'mattdemo',
    unavailable: { reason: 'no-token' as const },
  }

  it('is its own cell state, not unavailable', () => {
    expect(cellFor(fixture, reading).state).toBe('reading')
    expect(cellFor(fixture, untokened).state).toBe('unavailable')
  })

  // ⚠️ The check has to come before the `flows === undefined` branch, which a
  // column being read also satisfies. A hub that reports flows *and* is still
  // flagged as reading is not a state the app produces, so the one that can
  // actually happen — reading, with no flows — is what is pinned here.
  it('wins over the absence of flows', () => {
    const { flows: _none, ...withoutFlows } = { ...reading, flows: [] as HubFlow[] }
    expect(cellFor(fixture, withoutFlows).state).toBe('reading')
  })

  // ⚠️ Counting these would make the banner say the whole fleet has no token
  // for the first second of every visit, then count itself back down.
  it('is not counted among the hubs with no token', () => {
    expect(unavailableCount([reading, untokened])).toBe(1)
  })

  // ⚠️ And hiding them would delete columns that were about to fill.
  it('survives the hide-without-a-token toggle', () => {
    const visible = filterHubs([reading, untokened], '', { hideUnavailable: true })
    expect(visible.map((hub) => hub.name)).toEqual(['douglas'])
  })

  // "0 other flows" on a hub nobody has read is a measurement we have not made.
  it('reports no count in the other-flows row', () => {
    const [cell] = otherFlowsCells([fixture], [reading])
    expect(cell).toEqual({ hub: 'douglas', reading: true })
    expect(cell?.count).toBeUndefined()
  })

  it('is not treated as a hub the flow is on, for the concealed-rows warning', () => {
    expect(concealedRows([fixture], [reading], [])).toBe(0)
  })
})

describe('flowColumns', () => {
  const fleet = [
    { name: 'douglas', label: 'Douglas' },
    { name: 'anyafinn', label: 'AnyaFinn' },
    { name: 'mattdemo', label: 'mattdemo' },
  ]
  const flows = [{ id: 'a', label: 'Localise' }]

  it('turns each column’s read into the shape the grid wants', () => {
    const columns = flowColumns(fleet, (name) => {
      if (name === 'douglas') return { rows: flows }
      if (name === 'anyafinn') return { unavailable: { reason: 'denied', detail: 'revoked' } }
      return { reading: true }
    })
    expect(columns).toEqual([
      { name: 'douglas', label: 'Douglas', flows },
      { name: 'anyafinn', label: 'AnyaFinn', unavailable: { reason: 'denied', detail: 'revoked' } },
      { name: 'mattdemo', label: 'mattdemo', reading: true },
    ])
  })

  // The fleet is the config's, so the axis is complete and in order from the
  // first render — a column that appeared only once its hub answered would
  // make the grid jump about as it loaded.
  it('keeps every hub, in order, whatever each one answered', () => {
    const columns = flowColumns(fleet, () => ({ reading: true }))
    expect(columns.map((hub) => hub.name)).toEqual(['douglas', 'anyafinn', 'mattdemo'])
  })

  it('has no columns when the fleet is empty', () => {
    expect(flowColumns([], () => ({ reading: true }))).toEqual([])
  })
})
