/**
 * Which buttons a cell offers, and why it offers none (ADR-0023, QL-162).
 *
 * The grid decides what to *offer*; the server decides what to *allow*, by
 * re-reading the hub when the button is clicked. Both exist on purpose: this
 * side keeps someone from being shown an action that cannot work, and the
 * server side keeps a stale grid from doing damage. Neither is the other's
 * backup.
 *
 * ⚠️ Nothing here is a safety guard. A button that is absent here but allowed
 * by the server is a UI bug; a button that is present here but refused by the
 * server is correct and expected, because the grid's view can be minutes old.
 *
 * Pure, so every cell state's offer is testable without rendering.
 */

import type { CellState } from './flow-rows.js'

export type CellAction = 'push' | 'sync' | 'remove' | 'enable' | 'disable'

/**
 * The two that stop and ask before they run.
 *
 * A type rather than a convention: `confirmCopy` only knows how to word these
 * two, and before this existed it quietly treated anything that was not
 * `remove` as a sync — so the day a third action reached the dialog it would
 * have been announced as "Sync", with a sync's warning about overwriting the
 * hub's copy. The compiler now refuses that instead.
 */
export type ConfirmableAction = Extract<CellAction, 'sync' | 'remove'>

export function isConfirmable(action: CellAction): action is ConfirmableAction {
  return action === 'sync' || action === 'remove'
}

export type ActionOffer = {
  /** Buttons to render, in display order. Empty when the cell offers none. */
  actions: CellAction[]
  /** Why there are none, for the cell's title. Undefined when there are some. */
  reason?: string
}

/** The verb on the button, and what it does, for the tooltip. */
export const ACTION_LABEL: Record<CellAction, string> = {
  push: 'Push',
  sync: 'Sync',
  remove: 'Remove',
  enable: 'Enable',
  disable: 'Disable',
}

// ⚠️ `⏸` is also the cell glyph for the `disabled` state, which is deliberate
// rather than a clash: the two never appear together. A flow that is running
// shows `✓` and offers `⏸`; one that is paused shows `⏸` and offers `▶`.
export const ACTION_GLYPH: Record<CellAction, string> = {
  push: '+',
  sync: '⟳',
  remove: '✕',
  enable: '▶',
  disable: '⏸',
}

export const ACTION_EXPLANATION: Record<CellAction, string> = {
  push: 'Create this flow on this hub from the fixture in the repository.',
  sync:
    'Overwrite this hub’s copy with the fixture. If someone adjusted the flow on this hub for ' +
    'this customer, those changes go.',
  remove: 'Delete this flow from this hub, with its run history. There is no archive and no undo.',
  enable: 'Let this flow respond to its triggers again. Reversible from the same cell.',
  disable:
    'Stop this flow responding to its triggers. It stays on the hub with its run history, and ' +
    'can be enabled again from the same cell.',
}

/**
 * What this cell offers, given what the grid last saw.
 *
 * The three "it is there" states share sync and remove, which is the point:
 * what you can do to something that is there does not depend on whether it
 * happens to be running. They differ only in the one action that *is* about
 * running — and there the grid already knows the answer, because
 * `stateOfFlow` has read the hub's `ContentFlowStatus` to pick the state.
 *
 * ⚠️ Quarantined offers enable but not disable. Workforce quarantines a flow
 * that has failed repeatedly; it is already not responding to its triggers, so
 * "disable" would be a button that does nothing, and releasing it is the only
 * thing anyone wants from that cell. Whether the API accepts the change is its
 * business — a refusal is reported rather than guessed at here.
 */
export function offerFor(state: CellState): ActionOffer {
  switch (state) {
    case 'reading':
      // Nothing is offered against a column that has not answered. Acting on
      // a cell whose state is still unknown is the stale-grid problem with
      // the staleness built in.
      return { actions: [], reason: 'Still reading this hub.' }
    case 'absent':
      return { actions: ['push'] }
    case 'present':
      return { actions: ['disable', 'sync', 'remove'] }
    case 'disabled':
    case 'quarantined':
      return { actions: ['enable', 'sync', 'remove'] }
    case 'duplicate':
      // ⚠️ Including remove. Sync has nothing to pick between; remove has the
      // same ambiguity with a consequence that cannot be undone, and the two
      // candidates are usually two different flows that share a name rather
      // than two copies of ours.
      return {
        actions: [],
        reason:
          'Several flows on this hub share this label, so nothing here can tell which one the ' +
          'fixture means. Rename or delete one in Workforce — where you can see what each ' +
          'actually does — then refresh.',
      }
    case 'unavailable':
      return {
        actions: [],
        reason: 'This hub’s flows cannot be read, so nothing can be changed on it from here.',
      }
  }
}

/**
 * Whether an action needs the label typed back before it will run.
 *
 * Only `remove`. Enable and disable are undone by clicking the other half of
 * the same pair, so a dialog in front of them would be ceremony rather than a
 * guard — and a confirmation people learn to click through is worse than none,
 * because it trains the reflex that `remove` relies on being absent.
 */
export function needsTypedConfirmation(action: CellAction): boolean {
  return action === 'remove'
}

/**
 * Whether an action overwrites something that may have been changed on the hub.
 *
 * Not the same question as {@link needsTypedConfirmation}: a sync is
 * recoverable — push it again — but what it overwrites may not be, so it gets
 * a confirmation that names the hub without demanding the label.
 */
export function overwritesHubCopy(action: CellAction): boolean {
  return action === 'sync'
}

// ── Presentation, kept out of the components ─────────────────────────────────
//
// The dialog's wording and the cell's glyph are decisions, not markup: which
// verb, which colour, what is being lost. Left inline they become a row of
// ternaries nothing can test, and the copy that warns someone before an
// irreversible delete is the last copy that should go unchecked.

export type ConfirmCopy = {
  title: string
  /** The sentence under the title, naming the hub and what the action costs. */
  intro: string
  confirmLabel: string
  /** Whether the confirming button is the destructive variant. */
  danger: boolean
  /** Whether the dialog asks for the label to be typed back. */
  typed: boolean
}

/** Everything the confirmation dialog says, for one pending action. */
export function confirmCopy(
  action: ConfirmableAction,
  label: string,
  hubLabel: string,
): ConfirmCopy {
  const remove = action === 'remove'
  return {
    title: `${remove ? 'Remove' : 'Sync'} “${label}”`,
    intro: `${remove ? 'From' : 'To'} ${hubLabel}. ${ACTION_EXPLANATION[action]}`,
    confirmLabel: remove ? 'Remove from this hub' : 'Overwrite the hub’s copy',
    danger: remove,
    typed: needsTypedConfirmation(action),
  }
}

/** What a cell shows while an operation is running, or after one finished. */
export type CellOpState = 'running' | 'done' | 'failed'

/**
 * The glyph and words a cell shows, given its state and any operation on it.
 *
 * ⚠️ A finished operation shows its own tick rather than the cell's state, so
 * it holds only until the grid has re-read — the caller must then drop the
 * `op` and let the cell go back to describing the hub. The tick is feedback
 * about a click, not a claim about what is on the hub.
 *
 * That clearing lives in `FlowsTab`'s `run`, and for QL-162 it was missing:
 * the tick stayed put and covered the state glyph underneath. Nothing showed
 * it, because push ends on `present` whose glyph is `✓` anyway and sync both
 * starts and ends there — so the first action to change a glyph, disable, was
 * also the first to reveal it (QL-165). If this ever grows a second caller,
 * that caller owes the same clearing.
 */
export function cellDisplay(
  stateGlyph: string,
  stateLabel: string,
  op: CellOpState | undefined,
): { glyph: string; label: string } {
  if (op === 'running') return { glyph: '…', label: 'Working…' }
  if (op === 'done') return { glyph: '✓', label: stateLabel }
  if (op === 'failed') return { glyph: '!', label: 'Failed' }
  return { glyph: stateGlyph, label: stateLabel }
}
