/**
 * The shared operation log behind the Flows tab's drawer (ADR-0023, QL-162).
 *
 * Deliberately not flow-specific. The tab is growing two more tables —
 * webhook listeners and extensions — and all three will run the same shape of
 * per-cell operation against the same hubs. One log for the lot is the only
 * version that answers "what have I changed on this hub in the last ten
 * minutes", which is the question someone actually has before a demo.
 *
 * Pure, so the capping and the ordering are testable without rendering.
 */

/** Which table an entry came from. Listeners and extensions follow. */
export type OpSubject = 'flow' | 'listener' | 'extension'

/** One thing an operation did, as the server reported it. */
export type OpStep = {
  label: string
  detail?: string
  ms: number
}

export type OpEntry = {
  /** Unique per entry — the log can hold two attempts at the same cell. */
  id: string
  subject: OpSubject
  /** `push`, `sync`, `remove` — the verb the button used. */
  action: string
  /** Hub label, not its config name: the log is read, not joined on. */
  hub: string
  /** What was acted on — a flow's label, later a listener's or extension's. */
  name: string
  ok: boolean
  steps: OpStep[]
  error?: string
  /** Non-fatal things resolution reported, which are easy to lose otherwise. */
  warnings?: string[]
  at: number
}

/**
 * How many entries to keep.
 *
 * Enough to cover a working session, small enough that the drawer never
 * becomes the reason the page is slow. Older entries are dropped rather than
 * paged: this is a record of what just happened, not an audit trail, and
 * pretending otherwise would invite someone to rely on it as one.
 */
export const MAX_ENTRIES = 50

/** Newest first, capped. Returns a new array; never mutates the old one. */
export function addEntry(log: readonly OpEntry[], entry: OpEntry): OpEntry[] {
  return [entry, ...log].slice(0, MAX_ENTRIES)
}

/** Total of an entry's steps — what the drawer shows as the elapsed time. */
export function totalMs(entry: Pick<OpEntry, 'steps'>): number {
  return entry.steps.reduce((sum, step) => sum + step.ms, 0)
}

/**
 * `1234` → `1.2s`, `840` → `0.8s`, `60123` → `1m 0s`.
 *
 * Always a decimal below a minute: a bare "1s" next to "0.8s" reads as a
 * rounder, more deliberate number than it is.
 */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`
}

/** How many of the recent entries failed — the drawer's badge when collapsed. */
export function failureCount(log: readonly OpEntry[]): number {
  return log.filter((entry) => !entry.ok).length
}

/** A stable id for an entry, since two attempts on one cell both belong. */
export function entryId(subject: OpSubject, hub: string, name: string, at: number): string {
  return `${subject}:${hub}:${name}:${at}:${Math.random().toString(36).slice(2, 8)}`
}

// ── Building an entry ────────────────────────────────────────────────────────

/** Enough of a pending operation to label its log entry. */
export type LoggedOp = { action: string; hubLabel: string; label: string }

/** What the server returns from a per-cell operation. */
export type OpResult = {
  ok: boolean
  steps: OpStep[]
  error?: string
  warnings?: string[]
}

/**
 * Fold a server response into a log entry.
 *
 * ⚠️ The steps are kept even when `ok` is false. A failure part-way through
 * has usually already changed the hub — an extension installed before the
 * push was refused, say — and an entry that showed only the error would make
 * the next attempt look like the first one.
 */
export function entryFromResult(op: LoggedOp, result: OpResult, at: number): OpEntry {
  return {
    id: entryId('flow', op.hubLabel, op.label, at),
    subject: 'flow',
    action: op.action,
    hub: op.hubLabel,
    name: op.label,
    ok: result.ok,
    steps: result.steps,
    ...(result.error === undefined ? {} : { error: result.error }),
    ...(result.warnings === undefined || result.warnings.length === 0
      ? {}
      : { warnings: result.warnings }),
    at,
  }
}

/**
 * The entry for a request that never came back with a result at all.
 *
 * Distinct from a refusal: no steps, because nothing is known to have
 * happened — which is itself worth recording, since "we do not know" and
 * "nothing happened" are different states to retry from.
 */
export function entryFromError(op: LoggedOp, error: unknown, at: number): OpEntry {
  return {
    id: entryId('flow', op.hubLabel, op.label, at),
    subject: 'flow',
    action: op.action,
    hub: op.hubLabel,
    name: op.label,
    ok: false,
    steps: [],
    error: error instanceof Error ? error.message : String(error),
    at,
  }
}
