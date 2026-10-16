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

/** One extension instance as a hub's registry reports it. */
export type RegistryInstance = {
  id: string
  extensionId: string
  label?: string
  /** Pull does not need this; push builds the `label@version` handle from it. */
  version?: string
  /** The release the instance is pinned to, replayed into `data.instances[]`. */
  releaseId?: string
}

/** What a hub currently has — read one way by pull, the other way by push. */
export type FlowRegistry = {
  extensionInstances?: RegistryInstance[]
  /** `schema` is carried only by push, which replays it into the declaration. */
  listeners?: { id: string; label: string; schema?: string }[]
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
  icon?: FlowIcon | null
}

/**
 * What a `${extensionInstance:…}` handle meant on the hub it was pulled from.
 * Push matches the handle first and falls back to the extension.
 */
export type ReferencedInstance = {
  extension?: string
  sourceInstanceId: string
}

/** A flow's icon: a preset name and colour, the same on every hub. */
export type FlowIcon = { name: string; color: string }

/** A checked-in fixture: the same envelope with `flow` as real, tokenised JSON. */
export type FlowFixture = {
  label: string
  description?: string
  status?: string
  sourceHubId?: string
  icon?: FlowIcon
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
/** The same handle, built from a registry entry rather than from a title. */
export function handleOf(instance: { label?: string; version?: string } | undefined): string
/** The inverse of `parseInstanceTitle` — what the hub shows in the picker. */
export function instanceTitle(instance: { label?: string; version?: string } | undefined): string
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

/** Thrown when a token cannot be resolved. Push writes nothing after one. */
export class FlowResolutionError extends Error {}

/**
 * Resolve a fixture's tokens against a target hub and rebuild the hub-bound
 * half of `virtualActions`. Throws `FlowResolutionError` on the first token it
 * cannot resolve, naming the token and the hub.
 */
export function resolveGraph(
  fixture: FlowFixture,
  registry?: FlowRegistry,
  options?: {
    hub?: string
    /**
     * Extension ids the catalogue knows are public. A miss on one of these
     * means "not installed"; a miss on anything else means the extension is
     * custom, whose id differs per hub, so the label is matched instead.
     */
    publicExtensions?: Set<string>
  },
): { flow: FlowGraph; warnings: string[] }

/** Replay `data.instances[]`, `data.releases[].id`, the listeners and the picker. */
export function materialiseVirtualActions(
  flow: FlowGraph,
  context?: {
    instances?: Map<string, RegistryInstance>
    listeners?: { id: string; label: string; schema?: string }[]
  },
): FlowGraph

/** Empty every `config.reviewers`; unrecognised ids crash the Workforce UI. */
export function clearReviewers(flow: FlowGraph): { flow: FlowGraph; cleared: number }
/** Create, update, or refuse — labels are not unique, so there are three cases. */
export function planPush(
  label: string,
  existing: { id: string; label: string }[],
): { mode: 'create' } | { mode: 'update'; id: string; existing: { id: string; label: string } }
/** `{ name, color }` from whatever the API returned, or undefined. */
export function iconOf(icon: unknown): FlowIcon | undefined
/** The same pair, shaped for `CreateContentFlowInput.icon`. */
export function iconInput(icon: unknown): { preset: FlowIcon } | undefined
export function createFlowInput(
  fixture: FlowFixture,
  flow: FlowGraph,
  hubRef: string,
): {
  cmsHubId: string
  label: string
  description?: string
  flow: string
  icon?: { preset: FlowIcon }
}
export function updateFlowInput(
  fixture: FlowFixture,
  flow: FlowGraph,
  id: string,
): { id: string; label: string; description?: string; flow: string; icon?: { preset: FlowIcon } }
