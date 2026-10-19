// @vitest-environment jsdom
//
// The Flows tab end to end, with the API mocked (QL-127, QL-162).
//
// The pure modules already prove the grid's rules; what this covers is the
// wiring those rules hang off — that a cell offers the right buttons for its
// state, that a push reaches the API with the right hub and label, that a
// remove cannot happen without the dialog, and that the grid re-reads
// afterwards rather than patching one cell from the response.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FlowFixture, HubFlows } from '../flow-rows.js'
import { FlowsTab } from './FlowsTab.js'

/**
 * One scenario: the rows, and what each hub answers.
 *
 * ⚠️ Not `FlowsOverview` — that type is the rows alone now, because the hubs
 * reach the tab as a prop and their flows arrive per column. A test still
 * wants both halves in one literal, so it has its own shape rather than
 * pushing a `hubs` field back into the production type to suit the tests.
 */
type Scenario = { fixtures: FlowFixture[]; hubs: HubFlows[]; fixturesError?: string }

vi.mock('../api.js', () => ({
  api: { hubFlows: vi.fn(), flowOp: vi.fn() },
}))

const { api } = await import('../api.js')
const hubFlows = vi.mocked(api.hubFlows)
const flowOp = vi.mocked(api.flowOp)

afterEach(cleanup)

/**
 * A request that never answers.
 *
 * The grid's whole claim is that it renders without waiting for these, so a
 * stub that never settles is the only honest way to assert it — a slow one
 * would just be a race.
 */
const never = <T,>(): Promise<T> => new Promise<T>(() => undefined)

const LOCALISE = 'Localise Content Item [Org]'
const SCREENSHOT = 'Create page from a Screenshot [MI]'

const overview = (overrides: Partial<Scenario> = {}): Scenario => ({
  fixtures: [
    { label: LOCALISE, file: 'localise.json', local: false },
    { label: SCREENSHOT, file: 'screenshot.json', local: true },
  ],
  hubs: [
    {
      name: 'douglas',
      label: 'Douglas',
      flows: [
        {
          id: 'flow-1',
          label: LOCALISE,
          status: 'ENABLED',
          updatedDate: '2026-10-17T09:00:00Z',
        },
        { id: 'stray', label: 'Something nobody checked in', status: 'ENABLED' },
      ],
    },
    { name: 'mattdemo', label: 'mattdemo', unavailable: { reason: 'no-token' } },
  ],
  ...overrides,
})

/**
 * Render the tab against one scenario.
 *
 * The overview is still the single description of a scenario, as it was when
 * the grid arrived in one response — `mount` just takes it apart the way the
 * app now does: rows from disk, columns from the config the parent holds,
 * cells one hub at a time.
 */
const mount = (data: Scenario = overview()) => {
  hubFlows.mockImplementation((name: string) => {
    const hub = data.hubs.find((candidate) => candidate.name === name)
    return Promise.resolve(
      hub?.flows === undefined
        ? { unavailable: hub?.unavailable ?? { reason: 'error' as const } }
        : { rows: hub.flows },
    )
  })
  return render(
    <FlowsTab
      hubs={data.hubs.map(({ name, label }) => ({ name, label }))}
      fixtures={{
        fixtures: data.fixtures,
        ...(data.fixturesError === undefined ? {} : { fixturesError: data.fixturesError }),
      }}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  flowOp.mockResolvedValue({
    ok: true,
    action: 'push',
    hub: 'douglas',
    label: SCREENSHOT,
    steps: [
      { label: 'read the hub', detail: '6 flows', ms: 3000 },
      { label: 'created flow', ms: 2200 },
    ],
  })
})

/** Wait for the first load to settle. */
const loaded = () => screen.findByRole('table')

describe('FlowsTab — the grid', () => {
  it('renders a row per fixture and a column per hub', async () => {
    mount()
    await loaded()
    expect(screen.getByRole('rowheader', { name: (name) => name.includes(LOCALISE) })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'mattdemo' })).toBeDefined()
  })

  it('marks a locally-pulled fixture, so "what we ship" stays honest', async () => {
    mount()
    await loaded()
    expect(screen.getByTitle(/not checked in/)).toBeDefined()
  })

  // A hub with no token is a setup step, said once above the grid.
  it('explains the hubs it cannot read, once', async () => {
    mount()
    await loaded()
    expect(screen.getByText(/1 of 2 hubs have no Workforce personal access token/)).toBeDefined()
  })

  // Without this the grid implies the fixtures are all the flows there are.
  it('counts the hub’s flows that no fixture claims', async () => {
    mount()
    await loaded()
    expect(screen.getByText('Other flows')).toBeDefined()
    expect(screen.getByTitle(/no fixture in the repository claims/)).toBeDefined()
  })

  // The rows come from disk; losing them means there is no grid to draw, as
  // distinct from a hub failing, which costs one column.
  // A fixtures failure is read once at start-up and carried down as a reason,
  // so the tab renders it as a banner rather than having its own error path.
  it('shows why the fixtures could not be listed', () => {
    hubFlows.mockImplementation(never)
    render(
      <FlowsTab
        hubs={[{ name: 'douglas', label: 'Douglas' }]}
        fixtures={{ fixtures: [], fixturesError: 'API is down' }}
      />,
    )
    expect(screen.getByText('API is down')).toBeDefined()
  })

  // ⚠️ The point of the whole progressive read: the axes come from disk and
  // from config, so a hub that never answers costs its own column and nothing
  // else. Before this, one slow hub meant a blank tab.
  it('draws every row and column before any hub has answered', async () => {
    hubFlows.mockImplementation(never)
    render(
      <FlowsTab
        hubs={[
          { name: 'douglas', label: 'Douglas' },
          { name: 'mattdemo', label: 'mattdemo' },
        ]}
        fixtures={{ fixtures: overview().fixtures }}
      />,
    )
    await loaded()
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
    expect(screen.getByRole('rowheader', { name: (name) => name.includes(LOCALISE) })).toBeDefined()
    expect(screen.getAllByText('Reading…').length).toBeGreaterThan(0)
  })

  // A column still being read is not a column with no token, and the banner
  // that tells someone to go and set one up must not appear for it.
  it('does not call an unanswered hub untokened', async () => {
    hubFlows.mockImplementation(never)
    render(
      <FlowsTab
        hubs={[{ name: 'douglas', label: 'Douglas' }]}
        fixtures={{ fixtures: overview().fixtures }}
      />,
    )
    await loaded()
    expect(screen.queryByText(/no Workforce personal access token/)).toBeNull()
  })

  // ⚠️ The regression that made the whole split pointless: the table used to
  // be gated on the rows, so the grid stayed invisible until the fixture list
  // arrived even though every column header was already in hand.
  it('draws the table and its column headers before the rows arrive', async () => {
    hubFlows.mockImplementation(never)
    render(
      <FlowsTab
        hubs={[
          { name: 'douglas', label: 'Douglas' },
          { name: 'mattdemo', label: 'mattdemo' },
        ]}
        fixtures={null}
      />,
    )
    const table = await screen.findByRole('table')
    expect(table.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'mattdemo' })).toBeDefined()
    // Placeholder rows, so the grid has roughly its real height from the start.
    expect(screen.getAllByText('Reading…').length).toBeGreaterThan(1)
  })

  // What that moment must not do is fill itself with a wrong answer — "no flow
  // fixtures in the repository" is a claim, made before anything had looked.
  it('does not claim the repository is empty before the rows have arrived', () => {
    hubFlows.mockImplementation(never)
    render(<FlowsTab hubs={[{ name: 'douglas', label: 'Douglas' }]} fixtures={null} />)
    expect(screen.queryByText(/No flow fixtures/)).toBeNull()
  })

  // ⚠️ `reading` and `absent` shared the `·` glyph for a while, so a grid
  // mid-load looked exactly like one where nothing was installed anywhere.
  it('does not mark an unread cell the same as an empty one', async () => {
    hubFlows.mockImplementation(never)
    render(
      <FlowsTab
        hubs={[{ name: 'douglas', label: 'Douglas' }]}
        fixtures={{ fixtures: overview().fixtures }}
      />,
    )
    await loaded()
    const glyphs = [...document.querySelectorAll('.flow-cell__glyph')].map((el) => el.textContent)
    expect(glyphs.every((glyph) => glyph !== '·')).toBe(true)
  })

  // Hubs almost always carry flows the repository does not describe, so the
  // row showing is the common case — appearing late would grow the grid
  // underneath whatever the reader is already looking at.
  it('keeps the “Other flows” row up while the hubs are answering', async () => {
    hubFlows.mockImplementation(never)
    render(
      <FlowsTab
        hubs={[{ name: 'douglas', label: 'Douglas' }]}
        fixtures={{ fixtures: overview().fixtures }}
      />,
    )
    await loaded()
    expect(screen.getByText('Other flows')).toBeDefined()
  })

  // The placeholders are scaffolding, not content: left readable, a screen
  // reader walks four empty rows before reaching anything real.
  it('hides the placeholder rows from assistive technology', () => {
    hubFlows.mockImplementation(never)
    const { container } = render(
      <FlowsTab hubs={[{ name: 'douglas', label: 'Douglas' }]} fixtures={null} />,
    )
    const placeholders = [...container.querySelectorAll('tbody tr')]
    expect(placeholders.length).toBeGreaterThan(0)
    expect(placeholders.every((row) => row.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('says so once it has looked and found none', () => {
    hubFlows.mockImplementation(never)
    render(<FlowsTab hubs={[{ name: 'douglas', label: 'Douglas' }]} fixtures={{ fixtures: [] }} />)
    expect(screen.getByText(/No flow fixtures/)).toBeDefined()
  })
})

describe('FlowsTab — what a cell offers', () => {
  it('offers push on an absent cell and sync/remove on a present one', async () => {
    mount()
    await loaded()
    // Present on Douglas → sync + remove; absent on Douglas → push.
    expect(screen.getByRole('button', { name: 'Sync douglas' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Remove douglas' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Push douglas' })).toBeDefined()
  })

  // The enabled flow on Douglas offers pause; the absent one offers neither.
  it('offers disable on a running flow and nothing of the pair on an absent one', async () => {
    mount()
    await loaded()
    expect(screen.getByRole('button', { name: 'Disable douglas' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Enable douglas' })).toBeNull()
  })

  it('offers enable, not disable, once the hub says the flow is off', async () => {
    const paused = overview()
    paused.hubs[0]!.flows = [{ id: 'flow-1', label: LOCALISE, status: 'DISABLED' }]
    mount(paused)
    await loaded()
    expect(screen.getByRole('button', { name: 'Enable douglas' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Disable douglas' })).toBeNull()
  })

  // Nothing can be changed on a hub whose flows cannot be read.
  it('offers nothing on a hub with no token', async () => {
    mount()
    await loaded()
    expect(screen.queryByRole('button', { name: /mattdemo/ })).toBeNull()
  })

  // ⚠️ The decision from QL-162: a duplicate offers nothing at all, remove
  // included, because picking wrongly cannot be undone.
  it('offers nothing on a duplicate, and says why', async () => {
    const twins = overview()
    twins.hubs[0]!.flows = [
      { id: 'a', label: LOCALISE, status: 'ENABLED' },
      { id: 'b', label: LOCALISE, status: 'ENABLED' },
    ]
    mount(twins)
    await loaded()
    expect(screen.queryByRole('button', { name: 'Remove douglas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sync douglas' })).toBeNull()
    expect(screen.getByTitle(/Several flows on this hub share this label/)).toBeDefined()
  })
})

describe('FlowsTab — running an operation', () => {
  it('pushes straight through, with no dialog', async () => {
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    await waitFor(() =>
      expect(flowOp).toHaveBeenCalledWith('push', { hub: 'douglas', label: SCREENSHOT }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // ⚠️ Re-reads the clicked hub's whole column rather than the one cell: a
  // push can install an extension, which changes what every other row on that
  // hub resolves against.
  it('re-reads the hub it acted on after a successful push', async () => {
    mount()
    await loaded()
    await waitFor(() => expect(hubFlows).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    await waitFor(() => expect(hubFlows).toHaveBeenCalledTimes(3))
    expect(hubFlows).toHaveBeenLastCalledWith('douglas')
  })

  // ⚠️ The other half of that: the fleet-wide re-read this replaced sent a
  // request per hub to show the result of a click on one column.
  it('leaves the other hubs alone', async () => {
    mount()
    await loaded()
    await waitFor(() => expect(hubFlows).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    await waitFor(() => expect(hubFlows).toHaveBeenCalledTimes(3))
    expect(hubFlows.mock.calls.filter(([hub]) => hub === 'mattdemo')).toHaveLength(1)
  })

  it('logs what the push did, including how long each step took', async () => {
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    const activity = await screen.findByRole('button', { name: /Activity/ })
    fireEvent.click(activity)
    expect(screen.getByText('created flow')).toBeDefined()
    expect(screen.getByText('2.2s')).toBeDefined()
    // The total, which is the number that says a push took five seconds.
    expect(screen.getByText('5.2s')).toBeDefined()
  })

  it('logs a refusal without re-reading the grid', async () => {
    flowOp.mockResolvedValue({
      ok: false,
      action: 'push',
      hub: 'douglas',
      label: SCREENSHOT,
      steps: [],
      error: 'two flows share this label',
    })
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    expect(await screen.findByText('1 failed')).toBeDefined()
    expect(hubFlows.mock.calls.filter(([hub]) => hub === 'douglas')).toHaveLength(1)
  })

  it('logs a request that never came back at all', async () => {
    flowOp.mockRejectedValue(new Error('socket hang up'))
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    expect(await screen.findByText('1 failed')).toBeDefined()
  })
})

describe('FlowsTab — enabling and disabling', () => {
  // ⚠️ No dialog, deliberately: each undoes the other from the same cell, and
  // a confirmation people learn to click through would wear down the reflex
  // that the remove dialog depends on.
  it('disables straight through, with no dialog', async () => {
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Disable douglas' }))
    await waitFor(() =>
      expect(flowOp).toHaveBeenCalledWith('disable', { hub: 'douglas', label: LOCALISE }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // The status is what the grid colours the cell by, so a stale cell after a
  // pause is the one wrong answer this pair can give.
  it('re-reads the hub so the cell stops claiming the flow is running', async () => {
    mount()
    await loaded()
    await waitFor(() => expect(hubFlows).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Disable douglas' }))
    await waitFor(() =>
      expect(hubFlows.mock.calls.filter(([hub]) => hub === 'douglas')).toHaveLength(2),
    )
  })

  // ⚠️ The QL-165 bug: the success tick was never given back, so it sat on
  // the cell covering the state glyph and a paused flow went on showing a
  // green tick. Asserts the glyph, not just the buttons — the buttons were
  // right the whole time, which is why it went unnoticed.
  it('shows the paused state once the re-read lands, not a stuck tick', async () => {
    mount()
    // The hub reports the flow enabled, then disabled once the op has run.
    hubFlows.mockImplementation((name: string) => {
      if (name !== 'douglas') return Promise.resolve({ unavailable: { reason: 'no-token' } })
      return Promise.resolve({
        rows: [{ id: 'flow-1', label: LOCALISE, status: 'DISABLED' }],
      })
    })
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Disable douglas' }))

    expect(await screen.findByRole('button', { name: 'Enable douglas' })).toBeDefined()
    expect(screen.getByText('Disabled')).toBeDefined()
    // The tick is feedback about a click; it must not outlive the re-read.
    await waitFor(() => expect(document.querySelector('.flow-grid__cell--op-done')).toBeNull())
  })

  it('logs a refusal without re-reading the hub', async () => {
    flowOp.mockResolvedValue({
      ok: false,
      action: 'enable',
      hub: 'douglas',
      label: LOCALISE,
      steps: [],
      error: 'this flow is not on douglas any more',
    })
    const paused = overview()
    paused.hubs[0]!.flows = [{ id: 'flow-1', label: LOCALISE, status: 'DISABLED' }]
    mount(paused)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Enable douglas' }))
    expect(await screen.findByText('1 failed')).toBeDefined()
    expect(hubFlows.mock.calls.filter(([hub]) => hub === 'douglas')).toHaveLength(1)
  })
})

describe('FlowsTab — the guarded operations', () => {
  it('asks before a sync, and sends it once confirmed', async () => {
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Sync douglas' }))
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(flowOp).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Overwrite/ }))
    await waitFor(() =>
      expect(flowOp).toHaveBeenCalledWith('sync', { hub: 'douglas', label: LOCALISE }),
    )
  })

  // ⚠️ The one with no undo: it must not be reachable by a single click.
  it('never removes without the dialog and the typed label', async () => {
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Remove douglas' }))
    await screen.findByRole('dialog')
    expect(flowOp).not.toHaveBeenCalled()

    const confirm = screen.getByRole('button', { name: /Remove from this hub/ })
    expect(confirm).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText(/Type the flow/), { target: { value: LOCALISE } })
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(flowOp).toHaveBeenCalledWith('remove', {
        hub: 'douglas',
        label: LOCALISE,
        confirm: LOCALISE,
      }),
    )
  })

  it('sends nothing when the dialog is cancelled', async () => {
    mount()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Remove douglas' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(flowOp).not.toHaveBeenCalled()
  })
})

describe('FlowsTab — narrowing the hub axis', () => {
  /** Four hubs, so the hub filter clears FILTER_MIN_ITEMS and renders. */
  const fleet = (): Scenario => ({
    fixtures: [{ label: LOCALISE, file: 'localise.json', local: false }],
    hubs: [
      { name: 'douglas', label: 'Douglas', flows: [{ id: 'f1', label: LOCALISE }] },
      { name: 'anyafinn', label: 'AnyaFinn', flows: [] },
      { name: 'mattdemo', label: 'mattdemo', unavailable: { reason: 'no-token' } },
      { name: 'schaeffler', label: 'Schaeffler', unavailable: { reason: 'no-token' } },
    ],
  })

  it('hides the hubs with no token on request, and says how many', async () => {
    mount(fleet())
    await loaded()
    expect(screen.getByRole('columnheader', { name: 'mattdemo' })).toBeDefined()

    fireEvent.click(screen.getByLabelText(/Hide 2 without a token/))
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'mattdemo' })).toBeNull())
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
  })

  it('narrows the columns by name', async () => {
    mount(fleet())
    await loaded()
    fireEvent.change(screen.getByLabelText('Filter hubs'), { target: { value: 'doug' } })
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'AnyaFinn' })).toBeNull())
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
  })

  // ⚠️ The one wrong answer the tab could give: a row reading "not anywhere"
  // because the only hub it is on has been filtered out of view.
  it('warns when the filter has hidden the only hub a flow is on', async () => {
    mount(fleet())
    await loaded()
    fireEvent.change(screen.getByLabelText('Filter hubs'), { target: { value: 'anyafinn' } })
    expect(await screen.findByText(/on a hidden hub and on none of the/)).toBeDefined()
  })

  it('offers a way back when the filter matches no hub at all', async () => {
    mount(fleet())
    await loaded()
    fireEvent.change(screen.getByLabelText('Filter hubs'), { target: { value: 'zzzz' } })
    const reset = await screen.findByRole('button', { name: /Show all 4 hubs/ })
    fireEvent.click(reset)
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined())
  })
})
