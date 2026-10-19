// Hand-written declarations for the listener seeding logic, which stays plain
// ESM (.mjs) so the scripts import it without a TS loader.

/** A listener as a fixture authors it: real JSON, stringified at the call. */
export type ListenerFixture = {
  label: string
  /** The hub it was pulled from, as a flow fixture records. */
  sourceHubId?: string
  schema: unknown
}

/** A listener as the hub reports it, read in full rather than from the list. */
export type ExistingListener = {
  id: string
  label: string
  /** Amplience-minted, and the reason update takes an id rather than recreating. */
  url?: string
  schema?: string
  /** Only `__typename` ever comes back; the HMAC secret does not. */
  security?: { __typename?: string }
}

export type PlannedListener = ListenerFixture & { id: string; url?: string }

export type RefusedListener = {
  listener: ListenerFixture
  existing?: ExistingListener
  reason: string
}

export type ListenerPlan = {
  create: ListenerFixture[]
  update: PlannedListener[]
  unchanged: PlannedListener[]
  refused: RefusedListener[]
}

export type ListenerSecurity = { none: { dangerouslyAllowUnauthenticated: boolean } }

export const UNAUTHENTICATED: ListenerSecurity
export function listenerFileName(label: string | undefined): string
/** True only for an explicit `none` — an unknown shape is treated as protected. */
export function isUnauthenticated(listener: ExistingListener | undefined): boolean
export function schemaString(schema: unknown): string | undefined
export function schemaChanged(desired: unknown, existing: unknown): boolean
export function diffListeners(
  desired: ListenerFixture[],
  existing: ExistingListener[],
): ListenerPlan
export function createInput(
  listener: ListenerFixture,
  cmsHubId: string,
): { cmsHubId: string; label: string; schema?: string; security: ListenerSecurity }
export function updateInput(listener: PlannedListener): {
  id: string
  label: string
  schema?: string
}
export function parseFixture(json: unknown, source?: string): ListenerFixture
/** Turn a listener the hub returned into a fixture, warning if it is protected. */
export function toListenerFixture(
  listener: ExistingListener | undefined,
  options?: { sourceHubId?: string },
): { fixture: ListenerFixture; warnings: string[] }
