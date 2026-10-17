import { useId, useState } from 'react'

import { failureCount, formatMs, totalMs, type OpEntry } from '../op-log.js'

/**
 * What the per-cell operations did, newest first (ADR-0023, QL-162).
 *
 * Shared across the tab rather than owned by the flows table: the listener and
 * extension tables run the same shape of operation against the same hubs, and
 * one log is the only version that answers "what have I changed on this hub in
 * the last ten minutes" — which is the question someone has before a demo.
 *
 * Collapsed by default, because the cell's own spinner → tick already answers
 * "did that work". The drawer is for the follow-up question, which is what it
 * did on the way — a flow push can install an extension (QL-164), and that
 * deserves somewhere to be seen rather than a footnote nobody reads.
 */
export function OpLogDrawer({ log, onClear }: { log: OpEntry[]; onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  if (log.length === 0) return null

  const failures = failureCount(log)

  return (
    <section className="op-log">
      <div className="op-log__bar">
        <button
          type="button"
          className="btn btn--sm btn--ghost op-log__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span> Activity ({log.length})
        </button>

        {/* Shown whether or not the drawer is open: a failure that scrolled
            past as a red cell should still be findable afterwards. */}
        {failures > 0 && <span className="op-log__failures">{failures} failed</span>}

        {open && (
          <button type="button" className="btn btn--sm btn--ghost op-log__clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      {open && (
        <ol id={panelId} className="op-log__list">
          {log.map((entry) => (
            <li
              key={entry.id}
              className={`op-log__entry${entry.ok ? '' : ' op-log__entry--failed'}`}
            >
              <div className="op-log__head">
                <span className="op-log__action">{entry.action}</span>
                <span className="op-log__name">{entry.name}</span>
                <span className="op-log__hub">on {entry.hub}</span>
                <span className="op-log__total">{formatMs(totalMs(entry))}</span>
              </div>

              {entry.steps.length > 0 && (
                <ul className="op-log__steps">
                  {entry.steps.map((step, index) => (
                    // Steps have no id of their own and are never reordered —
                    // the index is the stable key here.
                    <li key={index} className="op-log__step">
                      <span className="op-log__step-label">{step.label}</span>
                      {step.detail !== undefined && (
                        <span className="op-log__step-detail">{step.detail}</span>
                      )}
                      <span className="op-log__step-ms">{formatMs(step.ms)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* The steps stay visible alongside a failure on purpose:
                  knowing an extension was installed before the push failed is
                  the difference between a clean retry and a confusing one. */}
              {entry.error !== undefined && <p className="op-log__error">{entry.error}</p>}

              {entry.warnings?.map((warning) => (
                <p key={warning} className="op-log__warning">
                  {warning}
                </p>
              ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
