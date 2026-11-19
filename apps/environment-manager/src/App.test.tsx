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
import type { Config, Environment, FixtureSetInfo } from './types.js'

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
vi.mock('./components/FixturesCard.js', () => ({
  FixturesCard: ({ set }: { set: FixtureSetInfo }) => <div data-testid={`set-${set.name}`} />,
}))
vi.mock('./components/EnvironmentForm.js', () => ({
  EnvironmentForm: () => <div data-testid="environment-form" />,
}))
vi.mock('./components/FlowsTab.js', () => ({
  FlowsTab: () => <div data-testid="flows-tab" />,
}))

vi.mock('./api.js', () => ({
  api: {
    list: vi.fn(),
    fixtureSets: vi.fn(),
    flowFixtures: vi.fn(),
    hubFlows: vi.fn(),
    flowOp: vi.fn(),
    reorder: vi.fn(),
    renameGroup: vi.fn(),
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

const fixtureSet = (name: string, origin: FixtureSetInfo['origin']): FixtureSetInfo => ({
  name,
  label: name,
  description: '',
  defaultBrand: name,
  defaultLocale: 'en-US',
  authoredLocales: ['en-US'],
  generatedDocs: false,
  origin,
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

describe('App — fixture sets', () => {
  /** Whether `a` comes before `b` in the document. */
  const before = (a: HTMLElement, b: HTMLElement) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

  beforeEach(() => {
    list.mockResolvedValue(config([hub('douglas')]))
  })

  // Built-in sets are shared through the repository; local ones exist on this
  // computer only. Listed under separate headings so nobody seeds a hub from a
  // set a teammate won't have without being able to tell.
  it('lists built-in and local sets under their own headings', async () => {
    fixtureSets.mockResolvedValue([
      fixtureSet('frontend-starter', 'built-in'),
      fixtureSet('acme', 'local'),
    ])
    render(<App />)
    const builtIn = await screen.findByText('Built-in fixture sets')
    const local = screen.getByText('Your fixture sets')
    const hubs = screen.getByText('Hubs')
    const shipped = await screen.findByTestId('set-frontend-starter')
    const mine = screen.getByTestId('set-acme')

    expect(before(builtIn, shipped)).toBe(true)
    expect(before(shipped, local)).toBe(true)
    expect(before(local, mine)).toBe(true)
    expect(before(mine, hubs)).toBe(true)
  })

  it('explains how to add a local set when there are none', async () => {
    fixtureSets.mockResolvedValue([fixtureSet('frontend-starter', 'built-in')])
    render(<App />)
    expect(await screen.findByText(/None yet/)).toBeDefined()
  })
})

describe('App — when the API cannot be reached', () => {
  // The API server restarts on every save to server/, so a page loaded mid-
  // restart must not show an empty set list until someone reloads it.
  it('retries the fixture sets once after a failure', async () => {
    list.mockResolvedValue(config([]))
    fixtureSets
      .mockRejectedValueOnce(new Error('restarting'))
      .mockResolvedValue([fixtureSet('frontend-starter', 'built-in')])
    render(<App />)
    expect(await screen.findByTestId('set-frontend-starter', {}, { timeout: 3000 })).toBeDefined()
    expect(fixtureSets).toHaveBeenCalledTimes(2)
  })

  it('reloads the fixture sets with Retry', async () => {
    list.mockRejectedValue(new Error('nope'))
    fixtureSets.mockRejectedValue(new Error('nope'))
    render(<App />)
    expect(await screen.findByText(/Could not reach the API server/)).toBeDefined()

    list.mockResolvedValue(config([]))
    fixtureSets.mockResolvedValue([fixtureSet('frontend-starter', 'built-in')])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('set-frontend-starter')).toBeDefined()
  })

  it('says so, and offers a retry that asks again', async () => {
    list.mockRejectedValue(new Error('nope'))
    render(<App />)
    expect(await screen.findByText(/Could not reach the API server/)).toBeDefined()

    list.mockResolvedValue(config([hub('douglas')]))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('tab', { name: 'Flows' })).toBeDefined()
  })
})

describe('App — groups and ordering', () => {
  const grouped = (name: string, group?: string): Environment => ({
    ...hub(name),
    ...(group === undefined ? {} : { group }),
  })

  const nudge = (name: string, key: 'ArrowUp' | 'ArrowDown') =>
    fireEvent.keyDown(
      screen.getByRole('button', {
        name: (label) => label.startsWith(`Reorder ${name}.`),
      }),
      { key, altKey: true },
    )

  beforeEach(() => {
    vi.mocked(api.reorder).mockResolvedValue(config([]))
  })

  it('lists hubs under their group, with ungrouped hubs last', async () => {
    list.mockResolvedValue(
      config([grouped('a'), grouped('b', 'Prospects'), grouped('c', 'Customers')]),
    )
    render(<App />)
    const titles = (await screen.findAllByRole('heading', { level: 4 })).map((h) => h.textContent)
    expect(titles).toEqual(['Prospects', 'Customers', 'Ungrouped'])
  })

  it('keeps a plain list when no hub is grouped', async () => {
    list.mockResolvedValue(config([grouped('a'), grouped('b')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0)
  })

  it('saves the new order when a hub is moved with the keyboard', async () => {
    list.mockResolvedValue(config([grouped('a'), grouped('b'), grouped('c')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    nudge('b', 'ArrowUp')
    expect(api.reorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })

  it('only moves a hub within its own group', async () => {
    list.mockResolvedValue(config([grouped('a', 'X'), grouped('b'), grouped('c', 'X')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    nudge('c', 'ArrowUp')
    expect(api.reorder).toHaveBeenCalledWith(['c', 'b', 'a'])
    vi.mocked(api.reorder).mockClear()
    nudge('c', 'ArrowDown')
    expect(api.reorder).not.toHaveBeenCalled()
  })

  it('offers no handles while a filter is applied', async () => {
    list.mockResolvedValue(config(['a', 'b', 'c', 'd', 'e'].map((n) => grouped(n))))
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Filter hubs'), {
      target: { value: 'b' },
    })
    await waitFor(() => expect(screen.getAllByTestId('environment-card')).toHaveLength(1))
    expect(screen.queryAllByRole('button', { name: /^Reorder/ })).toHaveLength(0)
  })

  it('saves the new order when a group is moved with the keyboard', async () => {
    list.mockResolvedValue(config([grouped('a', 'X'), grouped('b', 'Y'), grouped('c', 'X')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    fireEvent.keyDown(screen.getByRole('button', { name: /^Reorder group Y\./ }), {
      key: 'ArrowUp',
      altKey: true,
    })
    expect(api.reorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })

  it('offers no group handles with a single group', async () => {
    list.mockResolvedValue(config([grouped('a', 'X'), grouped('b')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    expect(screen.queryAllByRole('button', { name: /^Reorder group/ })).toHaveLength(0)
  })

  it('renames a group', async () => {
    vi.mocked(api.renameGroup).mockResolvedValue(config([]))
    list.mockResolvedValue(config([grouped('a', 'X'), grouped('b')]))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename group X' }))
    const input = screen.getByLabelText('New name for group X')
    fireEvent.change(input, { target: { value: ' Leads ' } })
    fireEvent.submit(input)
    expect(api.renameGroup).toHaveBeenCalledWith('X', 'Leads')
  })

  it('ignores a rename that changes nothing, and has no rename for Ungrouped', async () => {
    list.mockResolvedValue(config([grouped('a', 'X'), grouped('b')]))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename group X' }))
    fireEvent.submit(screen.getByLabelText('New name for group X'))
    expect(api.renameGroup).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Rename group Ungrouped' })).toBeNull()
  })

  it('does nothing when a hub is nudged past the end of its group', async () => {
    list.mockResolvedValue(config([grouped('a'), grouped('b')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    nudge('a', 'ArrowUp')
    expect(api.reorder).not.toHaveBeenCalled()
  })

  it('says so when the new order cannot be saved', async () => {
    vi.mocked(api.reorder).mockRejectedValue(new Error('nope'))
    list.mockResolvedValue(config([grouped('a'), grouped('b')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    nudge('b', 'ArrowUp')
    expect(await screen.findByText(/Could not save the new hub order/)).toBeDefined()
  })

  it('reorders by dragging a hub onto another', async () => {
    list.mockResolvedValue(config([grouped('a'), grouped('b'), grouped('c')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    const wrapperOf = (name: string) => {
      const found = screen.getByRole('button', {
        name: (label) => label.startsWith(`Reorder ${name}.`),
      })
      const wrapper = found.closest('.sortable-hub')
      if (wrapper === null) throw new Error('no wrapper')
      return wrapper
    }
    fireEvent.mouseDown(screen.getByRole('button', { name: /^Reorder a\./ }))
    fireEvent.dragStart(wrapperOf('a'), { dataTransfer: { effectAllowed: '', setData: vi.fn() } })
    fireEvent.dragOver(wrapperOf('c'))
    fireEvent.drop(wrapperOf('c'))
    expect(api.reorder).toHaveBeenCalledWith(['b', 'c', 'a'])
  })

  it('folds a group away and back', async () => {
    list.mockResolvedValue(config([grouped('a', 'Prospects'), grouped('b')]))
    render(<App />)
    const toggle = await screen.findByRole('button', { name: /^Prospects/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('does nothing when a group is nudged past the end', async () => {
    list.mockResolvedValue(config([grouped('a', 'X'), grouped('b', 'Y')]))
    render(<App />)
    await screen.findAllByTestId('environment-card')
    fireEvent.keyDown(screen.getByRole('button', { name: /^Reorder group X\./ }), {
      key: 'ArrowUp',
      altKey: true,
    })
    expect(api.reorder).not.toHaveBeenCalled()
  })

  it('says so when a group cannot be renamed', async () => {
    vi.mocked(api.renameGroup).mockRejectedValue(new Error('nope'))
    list.mockResolvedValue(config([grouped('a', 'X')]))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename group X' }))
    fireEvent.change(screen.getByLabelText('New name for group X'), { target: { value: 'Y' } })
    fireEvent.submit(screen.getByLabelText('New name for group X'))
    expect(await screen.findByText(/Could not rename the group/)).toBeDefined()
  })

  it('falls back to the identifier for a hub with no label', async () => {
    list.mockResolvedValue(config([{ ...grouped('a'), label: '' }, grouped('b')]))
    render(<App />)
    expect(await screen.findByRole('button', { name: /^Reorder a\./ })).toBeDefined()
  })
})
