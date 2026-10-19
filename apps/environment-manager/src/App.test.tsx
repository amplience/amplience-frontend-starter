// @vitest-environment jsdom
//
// The tab bar, and the one thing it has to get right.
//
// Sites and Flows are both *about* hubs — a site is deployed from one, a flow
// is pushed to one — so on an empty fleet they can only render an empty state
// explaining that there are no hubs. Content Sources already says that by
// being the place you add one. So the tabs do not exist until a hub does.
//
// ⚠️ Keyed on the hub list alone. Gating a tab on whether its own panel's data
// loaded would make the chrome flicker as reads land and couple the top level
// to every panel beneath it.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App.js'
import type { Config, Environment } from './types.js'

// ⚠️ The panels are stubbed, not rendered. This file is about the tab bar,
// and `App` imports the whole card layer — pulling `EnvironmentCard`,
// `SiteCard` and `FixturesCard` into the coverage denominator for the first
// time drops the repository's global branch coverage by about thirty-five
// points, for components this test says nothing about. Stub them and only
// `App` itself is measured, which is the file under test.
vi.mock('./components/EnvironmentCard.js', () => ({
  EnvironmentCard: () => <div data-testid="environment-card" />,
}))
vi.mock('./components/SiteCard.js', () => ({ SiteCard: () => <div /> }))
vi.mock('./components/FixturesCard.js', () => ({ FixturesCard: () => <div /> }))
vi.mock('./components/EnvironmentForm.js', () => ({
  EnvironmentForm: () => <div data-testid="environment-form" />,
}))
vi.mock('./components/FlowsTab.js', () => ({ FlowsTab: () => <div data-testid="flows-tab" /> }))

vi.mock('./api.js', () => ({
  api: {
    list: vi.fn(),
    fixtureSets: vi.fn(),
    flowFixtures: vi.fn(),
    hubFlows: vi.fn(),
    flowOp: vi.fn(),
  },
}))

const { api } = await import('./api.js')
const list = vi.mocked(api.list)
const fixtureSets = vi.mocked(api.fixtureSets)
const flowFixtures = vi.mocked(api.flowFixtures)

afterEach(cleanup)

/**
 * Only what `App` itself reads — the card that needs the rest is stubbed.
 *
 * `hubName` and `defaultBrand` are here because the hub filter matches on all
 * four visible fields, and an absent one throws rather than failing to match.
 */
const hub = (name: string): Environment =>
  ({
    name,
    label: name,
    hubName: name,
    defaultBrand: 'default',
    webApps: [],
  }) as unknown as Environment

const config = (environments: Environment[]): Config => ({
  environments,
  active: environments[0]?.name ?? '',
})

beforeEach(() => {
  vi.clearAllMocks()
  fixtureSets.mockResolvedValue([])
  flowFixtures.mockResolvedValue({ fixtures: [] })
  vi.mocked(api.hubFlows).mockImplementation(() => new Promise(() => undefined))
})

describe('App — the tab bar', () => {
  it('shows the tabs once there is a hub', async () => {
    list.mockResolvedValue(config([hub('douglas')]))
    render(<App />)
    expect(await screen.findByRole('tab', { name: 'Flows' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Sites' })).toBeDefined()
  })

  it('hides them entirely on an empty fleet', async () => {
    list.mockResolvedValue(config([]))
    render(<App />)
    await waitFor(() => expect(screen.getByText('Hubs')).toBeDefined())
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Flows' })).toBeNull()
  })

  // ⚠️ The empty fleet still needs the one screen that can fix it. Hiding the
  // tab bar must not hide the way to add a hub.
  it('still offers the way out of an empty fleet', async () => {
    list.mockResolvedValue(config([]))
    render(<App />)
    expect(await screen.findByRole('button', { name: /Add hub/ })).toBeDefined()
  })
})

describe('App — switching panels', () => {
  beforeEach(() => {
    list.mockResolvedValue(config([hub('douglas'), hub('anyafinn')]))
  })

  it('opens on Content Sources', async () => {
    render(<App />)
    expect(await screen.findByText('Hubs')).toBeDefined()
    expect(screen.queryByTestId('flows-tab')).toBeNull()
  })

  it('shows the flows grid when the Flows tab is picked', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Flows' }))
    expect(screen.getByTestId('flows-tab')).toBeDefined()
    expect(screen.queryByText('Hubs')).toBeNull()
  })

  it('marks exactly one tab as selected', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Sites' }))
    const selected = screen
      .getAllByRole('tab')
      .filter((tab) => tab.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]?.textContent).toBe('Sites')
  })

  it('opens the add-hub form on request', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Add hub/ }))
    expect(screen.getByTestId('environment-form')).toBeDefined()
  })

  // One card per hub, and the filter stays hidden below the threshold.
  it('lists a card per hub without a filter for a small fleet', async () => {
    render(<App />)
    await screen.findByText('Hubs')
    expect(screen.getAllByTestId('environment-card')).toHaveLength(2)
    expect(screen.queryByLabelText('Filter hubs')).toBeNull()
  })

  it('offers a filter once the fleet is large enough', async () => {
    list.mockResolvedValue(
      config(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) => hub(name))),
    )
    render(<App />)
    expect(await screen.findByLabelText('Filter hubs')).toBeDefined()
  })

  it('narrows the cards to the ones that match', async () => {
    list.mockResolvedValue(
      config(['douglas', 'anyafinn', 'cee', 'dee', 'eee', 'eff', 'gee', 'aitch'].map(hub)),
    )
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Filter hubs'), {
      target: { value: 'doug' },
    })
    await waitFor(() => expect(screen.getAllByTestId('environment-card')).toHaveLength(1))
  })

  it('says so, and offers a way back, when nothing matches', async () => {
    list.mockResolvedValue(
      config(['douglas', 'anyafinn', 'cee', 'dee', 'eee', 'eff', 'gee', 'aitch'].map(hub)),
    )
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Filter hubs'), {
      target: { value: 'zzzz' },
    })
    const clear = await screen.findByRole('button', { name: 'Clear filter' })
    fireEvent.click(clear)
    await waitFor(() => expect(screen.getAllByTestId('environment-card')).toHaveLength(8))
  })
})

describe('App — when the API cannot be reached', () => {
  it('says so, and offers a retry that asks again', async () => {
    list.mockRejectedValue(new Error('nope'))
    render(<App />)
    expect(await screen.findByText(/Could not reach the API server/)).toBeDefined()

    list.mockResolvedValue(config([hub('douglas')]))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('tab', { name: 'Flows' })).toBeDefined()
  })
})
