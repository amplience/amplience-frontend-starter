// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SortableSiteRow } from './SortableSiteRow.js'

afterEach(cleanup)

const transfer = () => ({ effectAllowed: '', setData: vi.fn() })

function setup(over: Partial<Parameters<typeof SortableSiteRow>[0]> = {}) {
  const props = {
    index: 1,
    label: 'Web (staging)',
    icon: <svg data-testid="globe" />,
    enabled: true,
    dragIndex: null as number | null,
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onMove: vi.fn(),
    ...over,
  }
  // The parent stands in for the hub's SortableHub wrapper, which has drag handlers of its own.
  const parent = { onDragStart: vi.fn(), onDragOver: vi.fn(), onDrop: vi.fn(), onDragEnd: vi.fn() }
  const view = render(
    <div {...parent}>
      <ul>
        <SortableSiteRow {...props}>
          <span>row</span>
        </SortableSiteRow>
      </ul>
    </div>,
  )
  const row = view.container.querySelector('li')
  if (!(row instanceof HTMLElement)) throw new Error('expected a row')
  const handle = () => screen.getByRole('button', { name: /^Reorder Web \(staging\)\./ })
  return { props, parent, row, handle, ...view }
}

describe('SortableSiteRow', () => {
  it('renders the icon and row, with a handle only when reordering is enabled', () => {
    setup()
    expect(screen.getByTestId('globe')).toBeDefined()
    expect(screen.getByText('row')).toBeDefined()
    cleanup()
    setup({ enabled: false })
    expect(screen.queryByRole('button', { name: /^Reorder/ })).toBeNull()
  })

  it('is draggable only while the handle is held', () => {
    const { row, handle } = setup()
    expect(row.draggable).toBe(false)
    fireEvent.mouseDown(handle())
    expect(row.draggable).toBe(true)
    fireEvent.mouseUp(handle())
    expect(row.draggable).toBe(false)
  })

  it('reports the drag start and end without starting a hub drag', () => {
    const { props, parent, row, handle } = setup()
    fireEvent.mouseDown(handle())
    const dataTransfer = transfer()
    fireEvent.dragStart(row, { dataTransfer })
    expect(props.onDragStart).toHaveBeenCalledWith(1)
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '1')
    fireEvent.dragEnd(row)
    expect(props.onDragEnd).toHaveBeenCalled()
    expect(row.draggable).toBe(false)
    expect(parent.onDragStart).not.toHaveBeenCalled()
    expect(parent.onDragEnd).not.toHaveBeenCalled()
  })

  it('marks the site being dragged', () => {
    const { row } = setup({ dragIndex: 1 })
    expect(row.className).toContain('site-row--dragging')
  })

  it('accepts a drop only from another site, and keeps it from the hub', () => {
    const accepted = setup({ dragIndex: 0 })
    expect(fireEvent.dragOver(accepted.row)).toBe(false)
    fireEvent.drop(accepted.row)
    expect(accepted.props.onMove).toHaveBeenCalledWith(0, 1)
    expect(accepted.parent.onDragOver).not.toHaveBeenCalled()
    expect(accepted.parent.onDrop).not.toHaveBeenCalled()
    cleanup()
    const own = setup({ dragIndex: 1 })
    expect(fireEvent.dragOver(own.row)).toBe(true)
    fireEvent.drop(own.row)
    expect(own.props.onMove).not.toHaveBeenCalled()
  })

  it('lets a hub drag pass over the row', () => {
    const { parent, row } = setup({ dragIndex: null })
    fireEvent.dragOver(row)
    fireEvent.drop(row)
    expect(parent.onDragOver).toHaveBeenCalled()
    expect(parent.onDrop).toHaveBeenCalled()
  })

  it('moves with Alt+arrow keys and keeps focus on the handle once moved', () => {
    const { props, handle, rerender } = setup()
    fireEvent.keyDown(handle(), { key: 'ArrowUp', altKey: true })
    expect(props.onMove).toHaveBeenCalledWith(1, 0)
    fireEvent.keyDown(handle(), { key: 'ArrowDown', altKey: true })
    expect(props.onMove).toHaveBeenCalledWith(1, 2)

    handle().blur()
    rerender(
      <div>
        <ul>
          <SortableSiteRow {...props} index={0}>
            <span>row</span>
          </SortableSiteRow>
        </ul>
      </div>,
    )
    expect(document.activeElement).toBe(handle())
  })

  it('ignores arrows without Alt, and other keys with it', () => {
    const { props, handle } = setup()
    fireEvent.keyDown(handle(), { key: 'ArrowUp' })
    fireEvent.keyDown(handle(), { key: 'Enter', altKey: true })
    expect(props.onMove).not.toHaveBeenCalled()
  })
})
