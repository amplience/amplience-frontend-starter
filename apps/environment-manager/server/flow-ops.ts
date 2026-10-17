// Per-cell flow operations: push, sync and remove (ADR-0023, QL-162).
//
// The Flows tab's buttons. The grid decides what to *offer*; this decides what
// is *allowed*, by re-reading the hub at the moment of the click. Those are not
// the same job, and the difference matters: the grid's view can be minutes old,
// so a cell offering "remove" may be describing a flow that someone already
// deleted, renamed, or duplicated since the page loaded. Every guard here is
// re-derived from a fresh read rather than trusted from the request.
//
// ⚠️ The three actions are not equally reversible, and the guards are sized to
// match rather than applied uniformly:
//
//   push    creates what is not there. Undo is a remove.
//   sync    overwrites a flow in place. Undo is another push — unless the hub's
//           copy had been adjusted for that customer, which is exactly the case
//           the confirmation exists to surface.
//   remove  deletes the flow and its run history. There is no undo and no
//           archive, so it needs the strongest guard of the three.
//
// Pure: no I/O, so the guards are testable without a hub.

import type { HubFlow } from './content-flows.ts'

export type FlowAction = 'push' | 'sync' | 'remove' | 'enable' | 'disable'

/** The two statuses this tab sets. `QUARANTINED` is Workforce's to assign. */
export type SettableStatus = 'ENABLED' | 'DISABLED'

export const STATUS_FOR: Record<'enable' | 'disable', SettableStatus> = {
  enable: 'ENABLED',
  disable: 'DISABLED',
}

/** One thing an operation did, with how long it took. */
export type OpStep = {
  /** What happened — "installed extension", "created flow". */
  label: string
  /** What it happened to. */
  detail?: string
  ms: number
}

export type OpOutcome = {
  ok: boolean
  action: FlowAction
  /** The environment's `name`, which is what the grid keys columns on. */
  hub: string
  label: string
  steps: OpStep[]
  /** The flow the hub ended up with, when there is one. */
  flowId?: string
  error?: string
}

/**
 * The key a running operation is registered under.
 *
 * ⚠️ Deliberately **not** the environment name. `runningOps` in `index.ts` is
 * keyed that way and holds the spawned seed/sync child for a hub; a flow op
 * registered under the same key would either be killed by a cancel meant for
 * the seed, or silently evict the seed's entry so that cancel then finds
 * nothing.
 * Flow ops are in-process GraphQL calls with no child to kill, so they get
 * their own registry and their own key — per cell, not per hub, because two
 * different flows on one hub are two unrelated operations.
 */
export function opKey(hub: string, label: string, action: FlowAction): string {
  return `${hub}\u0000${label}\u0000${action}`
}

// ── Guards ────────────────────────────────────────────────────────────────────

export type Match =
  | { ok: true; action: 'create' }
  | { ok: true; action: 'update'; flow: HubFlow }
  | { ok: true; action: 'delete'; flow: HubFlow }
  /**
   * `already` is true when the hub says the flow is in the asked-for state.
   *
   * ⚠️ Not a refusal, unlike every other stale-grid case here. Push, sync and
   * remove refuse on a stale view because acting on one costs something: a
   * duplicate, a clobbered edit, a deleted flow. Setting a status that is
   * already set costs nothing and is what the clicker wanted anyway, so it
   * succeeds and says so in the log rather than making someone refresh to be
   * told they were right.
   */
  | { ok: true; action: 'status'; flow: HubFlow; status: SettableStatus; already: boolean }
  | { ok: false; error: string }

/**
 * What this action should do against the hub as it is *now*, or why it cannot.
 *
 * The duplicate case refuses every action, including remove. Sync refuses
 * because nothing can say which of the two the fixture meant — but remove
 * refuses for a stronger reason: picking wrongly destroys a flow that may
 * exist only on that hub, with its run history, and the two candidates are
 * usually two genuinely different flows that happen to share a name rather
 * than two copies of ours. A label and a timestamp are not enough to authorise
 * that, and Workforce itself shows what each flow actually does.
 */
export function matchForAction(
  flows: readonly HubFlow[],
  label: string,
  action: FlowAction,
  hubLabel: string,
): Match {
  const wanted = label.trim()
  const matches = flows.filter((flow) => flow.label.trim() === wanted)

  if (matches.length > 1) {
    return {
      ok: false,
      error:
        `${matches.length} flows on ${hubLabel} are called "${wanted}" ` +
        `(${matches.map((f) => f.id).join(', ')}), so nothing here can tell which one this ` +
        `fixture means. Rename or delete one in Workforce — where you can see what each ` +
        `actually does — then try again.`,
    }
  }

  const found = matches[0]

  if (action === 'push') {
    return found === undefined
      ? { ok: true, action: 'create' }
      : {
          ok: false,
          error:
            `"${wanted}" is already on ${hubLabel}. The grid was showing an older view — ` +
            `refresh it, then use sync if you meant to overwrite the hub's copy.`,
        }
  }

  if (found === undefined) {
    return {
      ok: false,
      error:
        `"${wanted}" is not on ${hubLabel} any more. The grid was showing an older view — ` +
        `refresh it, then push if you meant to create it.`,
    }
  }

  if (action === 'sync') return { ok: true, action: 'update', flow: found }
  if (action === 'remove') return { ok: true, action: 'delete', flow: found }

  // ⚠️ `HubFlow.status` is a loose string on purpose, so an unexpected or
  // missing value must not be read as "already in that state" — that would
  // silently skip the mutation and report success for a flow nobody changed.
  // Anything that is not an exact match sends the mutation.
  const status = STATUS_FOR[action]
  return { ok: true, action: 'status', flow: found, status, already: found.status === status }
}

/**
 * Whether the typed confirmation matches the flow being removed.
 *
 * Trimmed and case-insensitive. The point of typing it is to make someone read
 * the label and notice if it is not the one they meant — not to test their
 * shift key, and a guard that rejects the right answer teaches people to
 * paste, which defeats it.
 */
export function confirmsRemoval(typed: string | undefined, label: string): boolean {
  return (typed ?? '').trim().toLowerCase() === label.trim().toLowerCase()
}

// ── Step recording ────────────────────────────────────────────────────────────

/**
 * Records what an operation did and how long each part took.
 *
 * The steps are the whole point of the response: a flow push can quietly
 * install an extension on the way through (QL-164), and "it worked" would hide
 * that. `now` is injected so the durations are testable.
 */
export class Steps {
  private readonly steps: OpStep[] = []
  private readonly now: () => number
  private last: number

  // ⚠️ A plain field, not a `private readonly now` parameter property. The API
  // server runs under `node --experimental-strip-types`, which removes type
  // syntax without emitting any — and a parameter property is the one piece of
  // TypeScript that needs code generated for it, so it fails to parse at
  // startup rather than at build time.
  constructor(now: () => number = () => Date.now()) {
    this.now = now
    this.last = now()
  }

  /** Record a step, timed from the end of the previous one. */
  add(label: string, detail?: string): void {
    const at = this.now()
    this.steps.push({ label, ...(detail === undefined ? {} : { detail }), ms: at - this.last })
    this.last = at
  }

  all(): OpStep[] {
    return [...this.steps]
  }

  /** Total of the recorded steps — not wall-clock, which would include the gaps. */
  totalMs(): number {
    return this.steps.reduce((sum, step) => sum + step.ms, 0)
  }
}

/** A one-line summary of an outcome, for the log drawer's collapsed state. */
export function summarise(outcome: OpOutcome): string {
  if (!outcome.ok) return `${outcome.action} failed — ${outcome.error ?? 'unknown error'}`
  const did = outcome.steps.map((step) => step.label).join(', ')
  return did === '' ? `${outcome.action} — nothing to do` : did
}
