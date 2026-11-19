import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  name: string
  label: string
  /** Names in this hub's section, in order; hubs only reorder within one. */
  siblings: string[]
  enabled: boolean
  dragName: string | null
  onDragStart: (name: string) => void
  onDragEnd: () => void
  onDrop: (from: string, to: string) => void
  /** Keyboard move by one place (Alt+↑/↓ on the handle). */
  onNudge: (name: string, delta: -1 | 1) => void
  children: ReactNode
}

/** Native drag-and-drop wrapper: only the handle arms dragging, so the card's own controls stay usable. */
export function SortableHub({
  name,
  label,
  siblings,
  enabled,
  dragName,
  onDragStart,
  onDragEnd,
  onDrop,
  onNudge,
  children,
}: Props) {
  const [armed, setArmed] = useState(false)
  const handleRef = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)

  // React moves the DOM node on reorder, which drops focus; put it back after a keyboard move.
  useEffect(() => {
    if (refocus.current) {
      handleRef.current?.focus()
      refocus.current = false
    }
  })

  const canDrop = dragName !== null && dragName !== name && siblings.includes(dragName)

  return (
    <div
      className={`sortable-hub${dragName === name ? ' sortable-hub--dragging' : ''}`}
      draggable={armed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', name)
        onDragStart(name)
      }}
      onDragOver={(e) => {
        if (canDrop) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!canDrop || dragName === null) return
        e.preventDefault()
        onDrop(dragName, name)
      }}
      onDragEnd={() => {
        setArmed(false)
        onDragEnd()
      }}
    >
      {enabled && (
        <button
          ref={handleRef}
          type="button"
          className="drag-handle"
          aria-label={`Reorder ${label}. Drag, or press Alt and the up or down arrow.`}
          title="Drag to reorder"
          onMouseDown={() => setArmed(true)}
          onMouseUp={() => setArmed(false)}
          onKeyDown={(e) => {
            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
            e.preventDefault()
            refocus.current = true
            onNudge(name, e.key === 'ArrowUp' ? -1 : 1)
          }}
        >
          ⠿
        </button>
      )}
      <div className="sortable-hub__card">{children}</div>
    </div>
  )
}
