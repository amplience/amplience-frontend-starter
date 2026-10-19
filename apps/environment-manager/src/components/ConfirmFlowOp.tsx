import { useEffect, useId, useRef, useState } from 'react'

import { confirmCopy, type CellAction, type ConfirmableAction } from '../flow-actions.js'

export type PendingOp = {
  action: CellAction
  /** Environment name — what the request is keyed on. */
  hub: string
  /** Hub label — what a human reads. */
  hubLabel: string
  label: string
}

/**
 * A pending op that actually reaches the dialog.
 *
 * Enable and disable are {@link PendingOp}s too — they are just run straight
 * away — so the narrowing is what keeps them out of here rather than a comment
 * asking the next person not to pass one.
 */
export type ConfirmableOp = PendingOp & { action: ConfirmableAction }

/**
 * The guard in front of a sync or a remove (ADR-0023, QL-162).
 *
 * Sized to the action rather than applied uniformly, which is the whole point:
 * a push creates something and is undone by a remove, so it gets no dialog at
 * all. The other two each lose something, and they lose different things.
 *
 *   sync    overwrites the hub's copy. If someone adjusted that flow on a
 *           customer's hub for that customer, it goes. Recoverable by pushing
 *           again — but what it overwrote is not.
 *   remove  deletes the flow and its run history, with no archive. The label
 *           has to be typed back, which is not bureaucracy: it is the one
 *           thing that makes someone read which flow they actually picked.
 *
 * ⚠️ Focus lands on Cancel, never on the confirming button, and remove's
 * button stays disabled until the typed label matches — so a Return held down
 * from the click that opened the dialog cannot carry straight through it.
 */
export function ConfirmFlowOp({
  op,
  onConfirm,
  onCancel,
}: {
  op: ConfirmableOp
  onConfirm: (confirm?: string) => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const inputId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const copy = confirmCopy(op.action, op.label, op.hubLabel)
  const matches = typed.trim().toLowerCase() === op.label.trim().toLowerCase()
  const canConfirm = !copy.typed || matches

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    // Same backdrop pattern as EnvironmentForm: dismiss only on a click that
    // landed on the backdrop itself, so a drag out of the dialog does not
    // close it, and Escape from anywhere inside.
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-title`}>
        <div className="modal__header">
          <h2 id={`${inputId}-title`}>{copy.title}</h2>
        </div>

        <div className="modal__body">
          <p>{copy.intro}</p>

          {copy.typed && (
            <div className="field">
              <label htmlFor={inputId}>Type the flow’s label to confirm</label>
              <input
                id={inputId}
                type="text"
                value={typed}
                autoComplete="off"
                spellCheck={false}
                placeholder={op.label}
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${copy.danger ? 'btn--danger' : 'btn--primary'}`}
            disabled={!canConfirm}
            onClick={() => onConfirm(copy.typed ? typed : undefined)}
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
