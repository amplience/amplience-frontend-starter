// @vitest-environment jsdom
//
// The filter input shared by the hub lists and the Flows tab.
//
// Its one piece of real behaviour is the debounced screen-reader
// announcement: filtering itself is instant, but announcing on every keystroke
// would give a burst of partial counts instead of one useful answer. That is
// invisible to anyone not using a screen reader, which is exactly why it is
// worth a test.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ListFilter } from './ListFilter.js'

afterEach(cleanup)

const props = {
  label: 'Filter hubs',
  placeholder: 'Filter hubs…',
  noun: 'hubs',
  resultCount: 3,
  totalCount: 14,
}

describe('ListFilter', () => {
  it('shows the count only while something is typed', () => {
    const { rerender } = render(<ListFilter {...props} value="" onChange={vi.fn()} />)
    expect(screen.queryByText(/Showing/)).toBeNull()

    rerender(<ListFilter {...props} value="doug" onChange={vi.fn()} />)
    expect(screen.getByText('Showing 3 of 14')).toBeDefined()
  })

  it('reports what was typed', () => {
    const onChange = vi.fn()
    render(<ListFilter {...props} value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Filter hubs'), { target: { value: 'doug' } })
    expect(onChange).toHaveBeenCalledWith('doug')
  })

  it('clears on Escape', () => {
    const onChange = vi.fn()
    render(<ListFilter {...props} value="doug" onChange={onChange} />)
    fireEvent.keyDown(screen.getByLabelText('Filter hubs'), { key: 'Escape' })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('ignores other keys', () => {
    const onChange = vi.fn()
    render(<ListFilter {...props} value="doug" onChange={onChange} />)
    fireEvent.keyDown(screen.getByLabelText('Filter hubs'), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  // The clear button only exists when there is something to clear.
  it('offers a clear button only while filtering, and clears on click', () => {
    const onChange = vi.fn()
    const { rerender } = render(<ListFilter {...props} value="" onChange={onChange} />)
    expect(screen.queryByRole('button', { name: /Clear hubs filter/ })).toBeNull()

    rerender(<ListFilter {...props} value="doug" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Clear hubs filter/ }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})

describe('ListFilter — the debounced announcement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const live = () => document.querySelector('[role="status"]')?.textContent

  // ⚠️ Only *changes* are debounced — the hook seeds its state with whatever
  // it was first given, so a fresh mount announces straight away. What must
  // not happen is a burst of partial counts while someone is still typing.
  it('holds the announcement back until the typing stops', () => {
    const { rerender } = render(<ListFilter {...props} value="" onChange={vi.fn()} />)
    expect(live()).toBe('')

    rerender(<ListFilter {...props} value="doug" onChange={vi.fn()} />)
    expect(live()).toBe('')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(live()).toBe('3 of 14 hubs match')
  })

  // Clearing the box should go quiet, not report the full count back.
  it('goes quiet when the filter is cleared', () => {
    const { rerender } = render(<ListFilter {...props} value="" onChange={vi.fn()} />)
    rerender(<ListFilter {...props} value="doug" onChange={vi.fn()} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(live()).toBe('3 of 14 hubs match')

    rerender(<ListFilter {...props} value="" onChange={vi.fn()} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(live()).toBe('')
  })
})
