// Hand-written declarations for the flow fixture logic, which stays plain ESM
// (.mjs) so the flows scripts import it without a TS loader.

/** A node in the graph. Open-ended: only the fields this module reads are named. */
export type FlowAction = {
  id?: string
  action?: string
  config?: Record<string, unknown>
  [key: string]: unknown
}

export type FlowEdge = {
  id?: string
  inputs?: Record<string, unknown>
  [key: string]: unknown
}

/** One action-type declaration. ⚠️ Mandatory — a flow without these is rejected. */
export type FlowVirtualAction = {
  name?: string
  baseAction?: string
  label?: string
  description?: string
  category?: string
  group?: string
  config?: { schema?: { properties?: Record<string, Record<string, unknown>> } }
  data?: Record<string, unknown>
  [key: string]: unknown
}

/** A flow graph as the Workforce API returns it, once parsed. */
export type FlowGraph = {
  actions?: FlowAction[]
  edges?: FlowEdge[]
  virtualActions?: FlowVirtualAction[]
}

/** A graph that has been through the tokeniser, which always sets both lists. */
export type TokenisedGraph = FlowGraph & { actions: FlowAction[]; edges: FlowEdge[] }

/** What a hub currently has, used to turn its own ids back into tokens. */
export type FlowRegistry = {
  /** Extension instances, each keyed back to the extension it instantiates. */
  extensionInstances?: { id: string; extensionId: string; label?: string }[]
  listeners?: { id: string; label: string }[]
  workflowStates?: { id: string; label: string }[]
}

/** The envelope the browser extension exports and `flows:pull` accepts. */
export type FlowExport = {
  label: string
  description?: string
  status?: string
  /** A JSON string from the API, or already-parsed JSON. */
  flow: string | FlowGraph
  sourceHubId?: string
}

/**
 * What a `${extensionInstance:…}` handle meant on the hub it was pulled from.
 * Push matches the handle first and falls back to the extension.
 */
export type ReferencedInstance = {
  extension?: string
  sourceInstanceId: string
}

/** A checked-in fixture: the same envelope with `flow` as real, tokenised JSON. */
export type FlowFixture = {
  label: string
  description?: string
  status?: string
  sourceHubId?: string
  extensionInstances?: Record<string, ReferencedInstance>
  flow: TokenisedGraph
}

export function decodeOpaqueId(value: unknown): string | undefined
export function opaqueType(value: unknown): string | undefined
export function stripVirtualAction(virtualAction: FlowVirtualAction): FlowVirtualAction
export function stripVirtualActions(
  virtualActions: FlowVirtualAction[] | undefined,
): FlowVirtualAction[] | undefined
/** Instance id → the title the hub shows, read from the flow's own schemas. */
export function instanceTitles(virtualActions: FlowVirtualAction[] | undefined): Map<string, string>
/** `Amplience Dynamic Content (v2.2.0)` → `{ label, version }`. */
export function parseInstanceTitle(title: string | undefined): { label: string; version?: string }
/** The text inside `${extensionInstance:…}` — `label@version`, or just the label. */
export function instanceHandle(title: string | undefined): string
export function tokeniseGraph(
  flow: FlowGraph,
  registry?: FlowRegistry,
): {
  flow: TokenisedGraph
  extensionInstances: Record<string, ReferencedInstance>
  warnings: string[]
}
/** Opaque ids still present after tokenising — reported, never rewritten. */
export function untokenisedReferences(flow: FlowGraph): string[]
export function fixtureFileName(label: string | undefined): string
export function toFixture(
  exported: FlowExport,
  registry?: FlowRegistry,
): { fixture: FlowFixture; warnings: string[]; leftover: string[] }
