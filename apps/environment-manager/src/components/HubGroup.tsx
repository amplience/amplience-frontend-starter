import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { Chevron } from './Chevron.js'

type Props = {
  title: string
  count: number
  /** Absent for the Ungrouped section, which has no name to change. */
  onRename?: (name: string) => void
  /** Whether this group can be dragged and dropped onto; false for Ungrouped or when filtering. */
  reorderable: boolean
  dragGroup: string | null
  onDragStart: (title: string) => void
  onDragEnd: () => void
  onDrop: (from: string, to: string) => void
  onNudge: (title: string, delta: -1 | 1) => void
  children: ReactNode
}

/** A foldable group of hub cards. The body is hidden, not unmounted, so running operations survive. */
export function HubGroup({
  title,
  count,
  onRename,
  reorderable,
  dragGroup,
  onDragStart,
  onDragEnd,
  onDrop,
  onNudge,
  children,
}: Props) {
  const [open, setOpen] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(title)
  const [armed, setArmed] = useState(false)
  const bodyId = useId()
  const handleRef = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  const renameRef = useRef<HTMLInputElement>(null)

  // React moves the DOM node on reorder, which drops focus; put it back after a keyboard move.
  useEffect(() => {
    if (refocus.current) {
      handleRef.current?.focus()
      refocus.current = false
    }
  })

  useEffect(() => {
    if (renaming) renameRef.current?.focus()
  }, [renaming])

  const canDrop = reorderable && dragGroup !== null && dragGroup !== title

  function submitRename() {
    const next = draft.trim()
    setRenaming(false)
    if (next !== '' && next !== title) onRename?.(next)
  }

  return (
    <section
      className={`hub-group${dragGroup === title ? ' hub-group--dragging' : ''}`}
      draggable={armed}
      onDragStart={(e) => {
        // Hub cards inside drag too, and their events bubble up to here.
        if (e.target !== e.currentTarget) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', title)
        onDragStart(title)
      }}
      onDragOver={(e) => {
        if (canDrop) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!canDrop || dragGroup === null) return
        e.preventDefault()
        onDrop(dragGroup, title)
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return
        setArmed(false)
        onDragEnd()
      }}
    >
      <div className="hub-group__head">
        {reorderable ? (
          <button
            ref={handleRef}
            type="button"
            className="drag-handle"
            aria-label={`Reorder group ${title}. Drag, or press Alt and the up or down arrow.`}
            title="Drag to reorder group"
            onMouseDown={() => setArmed(true)}
            onMouseUp={() => setArmed(false)}
            onKeyDown={(e) => {
              if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
              e.preventDefault()
              refocus.current = true
              onNudge(title, e.key === 'ArrowUp' ? -1 : 1)
            }}
          >
            ⠿
          </button>
        ) : (
          <div className="drag-handle">⠿</div>
        )}
        {renaming ? (
          <form
            className="hub-group__rename"
            onSubmit={(e) => {
              e.preventDefault()
              submitRename()
            }}
          >
            <input
              ref={renameRef}
              type="text"
              aria-label={`New name for group ${title}`}
              value={draft}
              autoComplete="off"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setRenaming(false)
              }}
              onBlur={() => setRenaming(false)}
            />
          </form>
        ) : (
          <>
            <button
              type="button"
              className="hub-group__toggle"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((v) => !v)}
            >
              <Chevron open={open} />
              <h4 className="hub-group__title">{title}</h4>
              <span className="hub-group__count">{count}</span>
            </button>
            {onRename !== undefined && (
              <button
                type="button"
                className="edit-button"
                aria-label={`Rename group ${title}`}
                title="Rename group"
                onClick={() => {
                  setDraft(title)
                  setRenaming(true)
                }}
              >
                ✎
              </button>
            )}
          </>
        )}
      </div>
      <div id={bodyId} className="hub-group__body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
