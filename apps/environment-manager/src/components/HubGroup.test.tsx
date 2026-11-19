// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HubGroup } from './HubGroup.js'

afterEach(cleanup)

function setup(over: Partial<Parameters<typeof HubGroup>[0]> = {}) {
  const props = {
    title: 'Prospects',
    count: 2,
    onRename: vi.fn(),
    reorderable: true,
    dragGroup: null as string | null,
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onDrop: vi.fn(),
    onNudge: vi.fn(),
    ...over,
  }
  const view = render(
    <HubGroup {...props}>
      <button type="button">child</button>
    </HubGroup>,
  )
  const section = view.container.firstElementChild
  if (!(section instanceof HTMLElement)) throw new Error('expected a section')
  const handle = () => screen.getByRole('button', { name: /^Reorder group/ })
  const openRename = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Rename group Prospects' }))
  const input = () => screen.getByLabelText('New name for group Prospects')
  return { props, section, handle, openRename, input, ...view }
}

describe('HubGroup', () => {
  it('shows the title and count, and folds its body', () => {
    setup()
    const toggle = screen.getByRole('button', { name: /^Prospects/ })
    expect(toggle.textContent).toContain('2')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('offers no rename or reorder handle when it has neither', () => {
    render(
      <HubGroup
        title="Ungrouped"
        count={1}
        reorderable={false}
        dragGroup={null}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onDrop={vi.fn()}
        onNudge={vi.fn()}
      >
        <p>child</p>
      </HubGroup>,
    )
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Reorder/ })).toBeNull()
  })

  describe('rename', () => {
    it('submits the trimmed name', () => {
      const { props, openRename, input } = setup()
      openRename()
      expect(document.activeElement).toBe(input())
      fireEvent.change(input(), { target: { value: '  Leads ' } })
      fireEvent.submit(input())
      expect(props.onRename).toHaveBeenCalledWith('Leads')
      expect(screen.queryByLabelText('New name for group Prospects')).toBeNull()
    })

    it('does nothing for a blank or unchanged name', () => {
      const { props, openRename, input } = setup()
      openRename()
      fireEvent.change(input(), { target: { value: '   ' } })
      fireEvent.submit(input())
      openRename()
      fireEvent.submit(input())
      expect(props.onRename).not.toHaveBeenCalled()
    })

    it('cancels on Escape or on leaving the field', () => {
      const { props, openRename, input } = setup()
      openRename()
      fireEvent.keyDown(input(), { key: 'Enter' })
      fireEvent.keyDown(input(), { key: 'Escape' })
      expect(screen.queryByLabelText('New name for group Prospects')).toBeNull()
      openRename()
      fireEvent.blur(input())
      expect(screen.queryByLabelText('New name for group Prospects')).toBeNull()
      expect(props.onRename).not.toHaveBeenCalled()
    })
  })

  describe('reordering', () => {
    it('is draggable only while the handle is held', () => {
      const { section, handle } = setup()
      expect(section.draggable).toBe(false)
      fireEvent.mouseDown(handle())
      expect(section.draggable).toBe(true)
      fireEvent.mouseUp(handle())
      expect(section.draggable).toBe(false)
    })

    it('reports its own drag, but not a hub dragged inside it', () => {
      const { props, section } = setup()
      const dataTransfer = { effectAllowed: '', setData: vi.fn() }
      fireEvent.dragStart(screen.getByText('child'), { dataTransfer })
      fireEvent.dragEnd(screen.getByText('child'))
      expect(props.onDragStart).not.toHaveBeenCalled()
      expect(props.onDragEnd).not.toHaveBeenCalled()

      fireEvent.dragStart(section, { dataTransfer })
      expect(props.onDragStart).toHaveBeenCalledWith('Prospects')
      expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'Prospects')
      fireEvent.dragEnd(section)
      expect(props.onDragEnd).toHaveBeenCalled()
    })

    it('marks the group being dragged', () => {
      const { section } = setup({ dragGroup: 'Prospects' })
      expect(section.className).toContain('hub-group--dragging')
    })

    it('accepts a drop only from another group, and only when reorderable', () => {
      const allowed = (over: Partial<Parameters<typeof HubGroup>[0]>) => {
        const { section } = setup(over)
        const result = fireEvent.dragOver(section)
        cleanup()
        return !result
      }
      expect(allowed({ dragGroup: 'Customers' })).toBe(true)
      expect(allowed({ dragGroup: null })).toBe(false)
      expect(allowed({ dragGroup: 'Prospects' })).toBe(false)
      expect(allowed({ dragGroup: 'Customers', reorderable: false })).toBe(false)
    })

    it('drops onto this group, and ignores a drop it cannot accept', () => {
      const accepted = setup({ dragGroup: 'Customers' })
      fireEvent.drop(accepted.section)
      expect(accepted.props.onDrop).toHaveBeenCalledWith('Customers', 'Prospects')
      cleanup()
      const ignored = setup({ dragGroup: null })
      fireEvent.drop(ignored.section)
      expect(ignored.props.onDrop).not.toHaveBeenCalled()
    })

    it('moves with Alt+arrow keys and keeps focus on the handle', () => {
      const { props, handle, rerender } = setup()
      fireEvent.keyDown(handle(), { key: 'ArrowUp', altKey: true })
      expect(props.onNudge).toHaveBeenCalledWith('Prospects', -1)
      fireEvent.keyDown(handle(), { key: 'ArrowDown', altKey: true })
      expect(props.onNudge).toHaveBeenCalledWith('Prospects', 1)

      rerender(
        <HubGroup {...props}>
          <button type="button">child</button>
        </HubGroup>,
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
})
