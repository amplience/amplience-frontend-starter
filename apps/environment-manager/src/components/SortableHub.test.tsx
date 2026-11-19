// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SortableHub } from './SortableHub.js'

afterEach(cleanup)

const transfer = () => ({ effectAllowed: '', setData: vi.fn() })

function setup(over: Partial<Parameters<typeof SortableHub>[0]> = {}) {
  const props = {
    name: 'b',
    label: 'Beta',
    siblings: ['a', 'b', 'c'],
    enabled: true,
    dragName: null as string | null,
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onDrop: vi.fn(),
    onNudge: vi.fn(),
    ...over,
  }
  const view = render(
    <SortableHub {...props}>
      <p>card</p>
    </SortableHub>,
  )
  const wrapper = view.container.firstElementChild
  if (!(wrapper instanceof HTMLElement)) throw new Error('expected a wrapper')
  const handle = () => screen.getByRole('button', { name: /^Reorder Beta\./ })
  return { props, wrapper, handle, ...view }
}

describe('SortableHub', () => {
  it('renders the card, with a handle only when reordering is enabled', () => {
    const on = setup()
    expect(screen.getByText('card')).toBeDefined()
    expect(on.handle()).toBeDefined()
    cleanup()
    setup({ enabled: false })
    expect(screen.queryByRole('button', { name: /^Reorder/ })).toBeNull()
  })

  it('is draggable only while the handle is held', () => {
    const { wrapper, handle } = setup()
    expect(wrapper.draggable).toBe(false)
    fireEvent.mouseDown(handle())
    expect(wrapper.draggable).toBe(true)
    fireEvent.mouseUp(handle())
    expect(wrapper.draggable).toBe(false)
  })

  it('reports the drag start and end, and disarms afterwards', () => {
    const { props, wrapper, handle } = setup()
    fireEvent.mouseDown(handle())
    const dataTransfer = transfer()
    fireEvent.dragStart(wrapper, { dataTransfer })
    expect(props.onDragStart).toHaveBeenCalledWith('b')
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'b')
    fireEvent.dragEnd(wrapper)
    expect(props.onDragEnd).toHaveBeenCalled()
    expect(wrapper.draggable).toBe(false)
  })

  it('marks the hub being dragged', () => {
    const { wrapper } = setup({ dragName: 'b' })
    expect(wrapper.className).toContain('sortable-hub--dragging')
  })

  it('accepts a drop only from another hub in the same section', () => {
    // fireEvent returns false when the event's default was prevented, i.e. a drop is allowed.
    const allowed = (dragName: string | null) => {
      const { wrapper } = setup({ dragName })
      const result = fireEvent.dragOver(wrapper)
      cleanup()
      return !result
    }
    expect(allowed('a')).toBe(true)
    expect(allowed(null)).toBe(false)
    expect(allowed('b')).toBe(false)
    expect(allowed('elsewhere')).toBe(false)
  })

  it('drops onto this hub, and ignores a drop it cannot accept', () => {
    const accepted = setup({ dragName: 'a' })
    fireEvent.drop(accepted.wrapper)
    expect(accepted.props.onDrop).toHaveBeenCalledWith('a', 'b')
    cleanup()
    const ignored = setup({ dragName: null })
    fireEvent.drop(ignored.wrapper)
    expect(ignored.props.onDrop).not.toHaveBeenCalled()
  })

  it('moves with Alt+arrow keys and keeps focus on the handle', () => {
    const { props, handle, rerender } = setup()
    fireEvent.keyDown(handle(), { key: 'ArrowUp', altKey: true })
    expect(props.onNudge).toHaveBeenCalledWith('b', -1)
    fireEvent.keyDown(handle(), { key: 'ArrowDown', altKey: true })
    expect(props.onNudge).toHaveBeenCalledWith('b', 1)

    rerender(
      <SortableHub {...props}>
        <p>card</p>
      </SortableHub>,
    )
    expect(document.activeElement).toBe(handle())
  })

  it('ignores arrows without Alt, and other keys with it', () => {
    const { props, handle } = setup()
    fireEvent.keyDown(handle(), { key: 'ArrowUp' })
    fireEvent.keyDown(handle(), { key: 'Enter', altKey: true })
    expect(props.onNudge).not.toHaveBeenCalled()
  })
})
