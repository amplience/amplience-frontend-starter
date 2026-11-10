import { useId, useState, type ReactNode } from 'react'

import { Chevron } from './Chevron.js'

type Props = {
  title: string
  /** One-line description of what the section holds; stays visible when collapsed. */
  caption: ReactNode
  /** Controls shown beside the title (a filter, say). Hidden while collapsed. */
  headerExtra?: ReactNode
  /** Sections start expanded: collapsing is the exception, not the default. */
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A titled section of the content-sources list that can be folded away.
 *
 * ⚠️ The body is hidden, not unmounted. Hub cards own in-flight operations and
 * their logs, so unmounting them on collapse would silently drop a running seed
 * or wipe from view (and its result with it).
 */
export function CollapsibleSection({
  title,
  caption,
  headerExtra,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <section className="env-list__section">
      <div className="env-list__section-head">
        <div className="env-list__header">
          <button
            type="button"
            className="env-list__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
          >
            <Chevron open={open} />
            <h3 className="env-list__title">{title}</h3>
          </button>
          {open && headerExtra}
        </div>
        <p className="env-list__caption">{caption}</p>
      </div>

      <div id={bodyId} className="env-list__section-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
