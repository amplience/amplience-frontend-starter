import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  index: number
  /** Site's display label, for the handle's accessible name. */
  label: string
  /** The row's globe icon; the handle takes its place on hover or focus. */
  icon: ReactNode
  enabled: boolean
  dragIndex: number | null
  onDragStart: (index: number) => void
  onDragEnd: () => void
  /** Move the site at `from` to `to` — by drop, or Alt+↑/↓ on the handle. */
  onMove: (from: number, to: number) => void
  children: ReactNode
}

/** A site row that reorders within its hub. Only the handle arms dragging, so the row's link and edit button stay usable. */
export function SortableSiteRow({
  index,
  label,
  icon,
  enabled,
  dragIndex,
  onDragStart,
  onDragEnd,
  onMove,
  children,
}: Props) {
  const [armed, setArmed] = useState(false)
  const handleRef = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)

  // React moves the DOM node on reorder, which drops focus; put it back once the row has moved.
  useEffect(() => {
    if (refocus.current) {
      handleRef.current?.focus()
      refocus.current = false
    }
  }, [index])

  const canDrop = enabled && dragIndex !== null && dragIndex !== index

  // The row sits inside its hub's SortableHub, so a site drag must not bubble up and start or land a
  // hub drag. Over/drop only stop while a site drag is under way, so a hub drag still crosses the rows.

  return (
    <li
      className={`site-row${dragIndex === index ? ' site-row--dragging' : ''}`}
      draggable={armed}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
        onDragStart(index)
      }}
      onDragOver={(e) => {
        if (dragIndex !== null) e.stopPropagation()
        if (canDrop) e.preventDefault()
      }}
      onDrop={(e) => {
        if (dragIndex !== null) e.stopPropagation()
        if (!canDrop || dragIndex === null) return
        e.preventDefault()
        onMove(dragIndex, index)
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        setArmed(false)
        onDragEnd()
      }}
    >
      <span className="site-row__lead">
        {icon}
        {enabled && (
          <button
            ref={handleRef}
            type="button"
            className="site-row__drag"
            aria-label={`Reorder ${label}. Drag, or press Alt and the up or down arrow.`}
            title="Drag to reorder"
            onMouseDown={() => setArmed(true)}
            onMouseUp={() => setArmed(false)}
            onKeyDown={(e) => {
              if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
              e.preventDefault()
              refocus.current = true
              onMove(index, index + (e.key === 'ArrowUp' ? -1 : 1))
            }}
          >
            ⠿
          </button>
        )}
      </span>
      {children}
    </li>
  )
}
