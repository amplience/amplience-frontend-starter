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

import type { FlowsOverview } from '../flow-rows.js'
import { FlowsTab } from './FlowsTab.js'

vi.mock('../api.js', () => ({
  api: { flows: vi.fn(), flowOp: vi.fn() },
}))

const { api } = await import('../api.js')
const flows = vi.mocked(api.flows)
const flowOp = vi.mocked(api.flowOp)

afterEach(cleanup)

const LOCALISE = 'Localise Content Item [Org]'
const SCREENSHOT = 'Create page from a Screenshot [MI]'

const overview = (overrides: Partial<FlowsOverview> = {}): FlowsOverview => ({
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

beforeEach(() => {
  vi.clearAllMocks()
  flows.mockResolvedValue(overview())
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
    render(<FlowsTab />)
    await loaded()
    expect(screen.getByRole('rowheader', { name: (name) => name.includes(LOCALISE) })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'mattdemo' })).toBeDefined()
  })

  it('marks a locally-pulled fixture, so "what we ship" stays honest', async () => {
    render(<FlowsTab />)
    await loaded()
    expect(screen.getByTitle(/not checked in/)).toBeDefined()
  })

  // A hub with no token is a setup step, said once above the grid.
  it('explains the hubs it cannot read, once', async () => {
    render(<FlowsTab />)
    await loaded()
    expect(screen.getByText(/1 of 2 hubs have no Workforce personal access token/)).toBeDefined()
  })

  // Without this the grid implies the fixtures are all the flows there are.
  it('counts the hub’s flows that no fixture claims', async () => {
    render(<FlowsTab />)
    await loaded()
    expect(screen.getByText('Other flows')).toBeDefined()
    expect(screen.getByTitle(/no fixture in the repository claims/)).toBeDefined()
  })

  it('shows an error instead of a half-grid when the read fails', async () => {
    flows.mockRejectedValue(new Error('API is down'))
    render(<FlowsTab />)
    expect(await screen.findByText('API is down')).toBeDefined()
  })
})

describe('FlowsTab — what a cell offers', () => {
  it('offers push on an absent cell and sync/remove on a present one', async () => {
    render(<FlowsTab />)
    await loaded()
    // Present on Douglas → sync + remove; absent on Douglas → push.
    expect(screen.getByRole('button', { name: 'Sync douglas' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Remove douglas' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Push douglas' })).toBeDefined()
  })

  // The enabled flow on Douglas offers pause; the absent one offers neither.
  it('offers disable on a running flow and nothing of the pair on an absent one', async () => {
    render(<FlowsTab />)
    await loaded()
    expect(screen.getByRole('button', { name: 'Disable douglas' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Enable douglas' })).toBeNull()
  })

  it('offers enable, not disable, once the hub says the flow is off', async () => {
    const paused = overview()
    paused.hubs[0]!.flows = [{ id: 'flow-1', label: LOCALISE, status: 'DISABLED' }]
    flows.mockResolvedValue(paused)
    render(<FlowsTab />)
    await loaded()
    expect(screen.getByRole('button', { name: 'Enable douglas' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Disable douglas' })).toBeNull()
  })

  // Nothing can be changed on a hub whose flows cannot be read.
  it('offers nothing on a hub with no token', async () => {
    render(<FlowsTab />)
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
    flows.mockResolvedValue(twins)
    render(<FlowsTab />)
    await loaded()
    expect(screen.queryByRole('button', { name: 'Remove douglas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sync douglas' })).toBeNull()
    expect(screen.getByTitle(/Several flows on this hub share this label/)).toBeDefined()
  })
})

describe('FlowsTab — running an operation', () => {
  it('pushes straight through, with no dialog', async () => {
    render(<FlowsTab />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    await waitFor(() =>
      expect(flowOp).toHaveBeenCalledWith('push', { hub: 'douglas', label: SCREENSHOT }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // ⚠️ Re-reads the whole grid rather than patching the clicked cell: a push
  // can install an extension, which changes what every other row on that hub
  // resolves against.
  it('re-reads the grid after a successful push', async () => {
    render(<FlowsTab />)
    await loaded()
    expect(flows).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    await waitFor(() => expect(flows).toHaveBeenCalledTimes(2))
  })

  it('logs what the push did, including how long each step took', async () => {
    render(<FlowsTab />)
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
    render(<FlowsTab />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Push douglas' }))
    expect(await screen.findByText('1 failed')).toBeDefined()
    expect(flows).toHaveBeenCalledTimes(1)
  })

  it('logs a request that never came back at all', async () => {
    flowOp.mockRejectedValue(new Error('socket hang up'))
    render(<FlowsTab />)
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
    render(<FlowsTab />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Disable douglas' }))
    await waitFor(() =>
      expect(flowOp).toHaveBeenCalledWith('disable', { hub: 'douglas', label: LOCALISE }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // The status is what the grid colours the cell by, so a stale cell after a
  // pause is the one wrong answer this pair can give.
  it('re-reads the grid so the cell stops claiming the flow is running', async () => {
    render(<FlowsTab />)
    await loaded()
    expect(flows).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Disable douglas' }))
    await waitFor(() => expect(flows).toHaveBeenCalledTimes(2))
  })

  // ⚠️ The QL-165 bug: the success tick was never given back, so it sat on
  // the cell covering the state glyph and a paused flow went on showing a
  // green tick. Asserts the glyph, not just the buttons — the buttons were
  // right the whole time, which is why it went unnoticed.
  it('shows the paused state once the re-read lands, not a stuck tick', async () => {
    const paused = overview()
    flows.mockResolvedValueOnce(overview()).mockResolvedValueOnce({
      ...paused,
      hubs: [
        {
          name: 'douglas',
          label: 'Douglas',
          flows: [{ id: 'flow-1', label: LOCALISE, status: 'DISABLED' }],
        },
        paused.hubs[1]!,
      ],
    })
    render(<FlowsTab />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Disable douglas' }))

    expect(await screen.findByRole('button', { name: 'Enable douglas' })).toBeDefined()
    expect(screen.getByText('Disabled')).toBeDefined()
    // The tick is feedback about a click; it must not outlive the re-read.
    await waitFor(() => expect(document.querySelector('.flow-grid__cell--op-done')).toBeNull())
  })

  it('logs a refusal without re-reading', async () => {
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
    flows.mockResolvedValue(paused)
    render(<FlowsTab />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Enable douglas' }))
    expect(await screen.findByText('1 failed')).toBeDefined()
    expect(flows).toHaveBeenCalledTimes(1)
  })
})

describe('FlowsTab — the guarded operations', () => {
  it('asks before a sync, and sends it once confirmed', async () => {
    render(<FlowsTab />)
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
    render(<FlowsTab />)
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
    render(<FlowsTab />)
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
  const fleet = (): FlowsOverview => ({
    fixtures: [{ label: LOCALISE, file: 'localise.json', local: false }],
    hubs: [
      { name: 'douglas', label: 'Douglas', flows: [{ id: 'f1', label: LOCALISE }] },
      { name: 'anyafinn', label: 'AnyaFinn', flows: [] },
      { name: 'mattdemo', label: 'mattdemo', unavailable: { reason: 'no-token' } },
      { name: 'schaeffler', label: 'Schaeffler', unavailable: { reason: 'no-token' } },
    ],
  })

  it('hides the hubs with no token on request, and says how many', async () => {
    flows.mockResolvedValue(fleet())
    render(<FlowsTab />)
    await loaded()
    expect(screen.getByRole('columnheader', { name: 'mattdemo' })).toBeDefined()

    fireEvent.click(screen.getByLabelText(/Hide 2 without a token/))
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'mattdemo' })).toBeNull())
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
  })

  it('narrows the columns by name', async () => {
    flows.mockResolvedValue(fleet())
    render(<FlowsTab />)
    await loaded()
    fireEvent.change(screen.getByLabelText('Filter hubs'), { target: { value: 'doug' } })
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'AnyaFinn' })).toBeNull())
    expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined()
  })

  // ⚠️ The one wrong answer the tab could give: a row reading "not anywhere"
  // because the only hub it is on has been filtered out of view.
  it('warns when the filter has hidden the only hub a flow is on', async () => {
    flows.mockResolvedValue(fleet())
    render(<FlowsTab />)
    await loaded()
    fireEvent.change(screen.getByLabelText('Filter hubs'), { target: { value: 'anyafinn' } })
    expect(await screen.findByText(/on a hidden hub and on none of the/)).toBeDefined()
  })

  it('offers a way back when the filter matches no hub at all', async () => {
    flows.mockResolvedValue(fleet())
    render(<FlowsTab />)
    await loaded()
    fireEvent.change(screen.getByLabelText('Filter hubs'), { target: { value: 'zzzz' } })
    const reset = await screen.findByRole('button', { name: /Show all 4 hubs/ })
    fireEvent.click(reset)
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Douglas' })).toBeDefined())
  })
})
