// @vitest-environment jsdom
//
// The collapsible sections of the content-sources list. Two behaviours are
// worth pinning: the chevron points down while collapsed and up while
// expanded (a right-pointing one reads as "opens a new page"), and collapsing
// hides the body without unmounting it — hub cards own running operations that
// would otherwise vanish mid-flight.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { CollapsibleSection } from './CollapsibleSection.js'

afterEach(cleanup)

const chevronOf = (button: HTMLElement) => button.querySelector('svg.chevron')

describe('CollapsibleSection', () => {
  it('starts expanded, with the chevron pointing up', () => {
    render(
      <CollapsibleSection title="Hubs" caption="Live hubs.">
        <p>body</p>
      </CollapsibleSection>,
    )
    const toggle = screen.getByRole('button', { name: 'Hubs' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(chevronOf(toggle)?.classList.contains('chevron--open')).toBe(true)
    expect(screen.getByText('body').closest('[hidden]')).toBeNull()
  })

  it('collapses on click: chevron points down and the body is hidden', () => {
    render(
      <CollapsibleSection title="Hubs" caption="Live hubs.">
        <p>body</p>
      </CollapsibleSection>,
    )
    const toggle = screen.getByRole('button', { name: 'Hubs' })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(chevronOf(toggle)?.classList.contains('chevron--open')).toBe(false)
    expect(screen.getByText('body').closest('[hidden]')).not.toBeNull()
  })

  it('keeps the caption visible while collapsed', () => {
    render(
      <CollapsibleSection title="Hubs" caption="Live hubs.">
        <p>body</p>
      </CollapsibleSection>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hubs' }))
    expect(screen.getByText('Live hubs.').closest('[hidden]')).toBeNull()
  })

  // ⚠️ Hidden, not unmounted: a card's in-flight operation and its log live in
  // the card's own state.
  it('keeps children mounted while collapsed, so their state survives', () => {
    function Counter() {
      const [n, setN] = useState(0)
      return <button onClick={() => setN(n + 1)}>count {n}</button>
    }
    render(
      <CollapsibleSection title="Hubs" caption="Live hubs.">
        <Counter />
      </CollapsibleSection>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'count 0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hubs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hubs' }))
    expect(screen.getByRole('button', { name: 'count 1' })).toBeDefined()
  })

  it('shows header extras only while expanded', () => {
    render(
      <CollapsibleSection title="Hubs" caption="Live hubs." headerExtra={<span>filter</span>}>
        <p>body</p>
      </CollapsibleSection>,
    )
    expect(screen.getByText('filter')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Hubs' }))
    expect(screen.queryByText('filter')).toBeNull()
  })
})
