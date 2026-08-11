// Hand-written declarations for the runtime resolver, which stays plain ESM
// (.mjs) so `node scripts/hub-import.mjs` can import it without a TS loader.
// This lets the .ts test and typecheck see real types for the import.

export type WorkflowStateDef = {
  id?: string
  label?: string
  color?: string
}

export type SettingsJson = {
  workflowStates?: WorkflowStateDef[]
}

/** dc-cli's content-mapping save shape: workflowStates is [[fromId, toId], …]. */
export type SettingsMap = {
  workflowStates?: string[][]
}

/** A configured deployment a webhook definition is expanded for. */
export type SiteTarget = {
  /** Origin, trailing slash already stripped. */
  url: string
  /** Display label — what makes per-site webhook labels distinguishable. */
  label: string
}

export type ResolveOptions = {
  hub?: string
  repoContent?: string
  repoSiteComponents?: string
  statusMap?: Map<string, string>
  /** Fills ${site:url} / ${site:label} (webhooks step). */
  site?: SiteTarget
  /** Fills ${secret:name} (webhooks step); resolved in memory only. */
  secrets?: Map<string, string>
  source?: string
}

/** Join label → source id (settings) with source id → target id (dc-cli map). */
export function buildStatusMap(
  settingsJson: SettingsJson | null | undefined,
  settingsMap: SettingsMap | null | undefined,
): Map<string, string>

/** Resolve every ${…} token in `text`; throws on the first unresolved token. */
export function resolveTokens(text: string, options: ResolveOptions): string

/** Fields a dc-cli export carries that describe an instance, not a definition. */
export const EXTENSION_INSTANCE_FIELDS: readonly string[]

/** Shallow copy of `obj` without the given keys. */
export function stripFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): Partial<T>
