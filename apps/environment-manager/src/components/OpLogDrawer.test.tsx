// @vitest-environment jsdom
//
// The shared operation log (QL-162). Worth testing rather than eyeballing
// because two of its behaviours are load-bearing and silent: a failure stays
// findable after the red cell has scrolled away, and the steps survive
// alongside an error so a part-way failure is distinguishable from one that
// changed nothing.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OpEntry } from '../op-log.js'
import { OpLogDrawer } from './OpLogDrawer.js'

afterEach(cleanup)

const entry = (overrides: Partial<OpEntry> = {}): OpEntry => ({
  id: 'e1',
  subject: 'flow',
  action: 'push',
  hub: 'Douglas',
  name: 'Create page from a Screenshot [MI]',
  ok: true,
  steps: [
    { label: 'read the hub', detail: '6 flows', ms: 3000 },
    { label: 'created flow', detail: 'Create page from a Screenshot [MI]', ms: 2200 },
  ],
  at: 1_792_000_000_000,
  ...overrides,
})

describe('OpLogDrawer', () => {
  it('renders nothing at all until something has happened', () => {
    const { container } = render(<OpLogDrawer log={[]} onClear={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  // Collapsed by default: the cell's own tick already answered "did that work".
  it('starts collapsed, showing only the count', () => {
    render(<OpLogDrawer log={[entry()]} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Activity \(1\)/ })).toHaveProperty(
      'ariaExpanded',
      'false',
    )
    expect(screen.queryByText('created flow')).toBeNull()
  })

  it('opens to show every step with its own duration', () => {
    render(<OpLogDrawer log={[entry()]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    expect(screen.getByText('read the hub')).toBeDefined()
    expect(screen.getByText('created flow')).toBeDefined()
    expect(screen.getByText('3.0s')).toBeDefined()
    expect(screen.getByText('2.2s')).toBeDefined()
    // The total, which is what tells you the push was five seconds not fifty.
    expect(screen.getByText('5.2s')).toBeDefined()
  })

  // ⚠️ Visible while collapsed on purpose — a failure whose red cell has
  // scrolled off should still be findable.
  it('shows the failure count without being opened', () => {
    render(<OpLogDrawer log={[entry({ ok: false, error: 'refused' })]} onClear={vi.fn()} />)
    expect(screen.getByText('1 failed')).toBeDefined()
  })

  it('says nothing about failures when there were none', () => {
    render(<OpLogDrawer log={[entry()]} onClear={vi.fn()} />)
    expect(screen.queryByText(/failed/)).toBeNull()
  })

  // ⚠️ The case that matters: an extension was installed, then the flow push
  // was refused. Showing only the error would make the retry look like a
  // first attempt.
  it('keeps the steps visible next to an error', () => {
    const failed = entry({
      ok: false,
      error: 'the flow was refused',
      steps: [{ label: 'installed extension', detail: 'Amplience Dynamic Content', ms: 1200 }],
    })
    render(<OpLogDrawer log={[failed]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    expect(screen.getByText('installed extension')).toBeDefined()
    expect(screen.getByText('the flow was refused')).toBeDefined()
  })

  it('shows warnings, which are otherwise easy to lose', () => {
    const warned = entry({ warnings: ['matched on its label alone'] })
    render(<OpLogDrawer log={[warned]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    expect(screen.getByText('matched on its label alone')).toBeDefined()
  })

  it('offers Clear only once open, and calls back', () => {
    const onClear = vi.fn()
    render(<OpLogDrawer log={[entry()]} onClear={onClear} />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('lists several entries, newest as given', () => {
    render(
      <OpLogDrawer
        log={[entry({ id: 'a', name: 'Newest' }), entry({ id: 'b', name: 'Older' })]}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Activity \(2\)/ }))
    const names = screen.getAllByText(/Newest|Older/).map((n) => n.textContent)
    expect(names).toEqual(['Newest', 'Older'])
  })

  it('copes with an entry that recorded no steps', () => {
    render(
      <OpLogDrawer
        log={[entry({ steps: [], ok: false, error: 'never started' })]}
        onClear={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    expect(screen.getByText('never started')).toBeDefined()
  })

  it('omits a step detail when there is none', () => {
    const noDetail = entry({ steps: [{ label: 'read the hub', ms: 100 }] })
    const { container } = render(<OpLogDrawer log={[noDetail]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    expect(screen.getByText('read the hub')).toBeDefined()
    expect(container.querySelector('.op-log__step-detail')).toBeNull()
  })
})
