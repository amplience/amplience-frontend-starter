import { useId, useState, type ReactNode } from 'react'

import { Chevron } from './Chevron.js'

/** A foldable group of hub cards. The body is hidden, not unmounted, so running operations survive. */
export function HubGroup({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()

  return (
    <section className="hub-group">
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
      <div id={bodyId} className="hub-group__body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
