/**
 * Shared contracts for the renderer and component registry.
 *
 * These are the type-level surfaces locked in by ADR-0009 (component
 * contract) and ADR-0010 (renderer pattern):
 *
 *  - `ComponentRegistryEntry<TSchema, TProps>` — a component plus its
 *    schema→props adapter, generic over both interfaces.
 *  - `Registry` — the Map a deployment composes and passes to
 *    `renderContent`. Argument-passing per ADR-0010 Axis 1B.
 *  - `RendererFailure` — the three loud-failure classes the dispatcher
 *    emits when dispatch cannot complete.
 *
 * This package is types-only: nothing here survives compilation.
 */

import type { ComponentType } from 'react'

/**
 * A schema URI as it appears in content `_meta.schema` — the dispatch key.
 * Per ADR-0010 §3 there is no aliasing or transformation: the URI in the
 * content is the URI in the registry.
 */
export type SchemaURI = string

/**
 * Per-node rendering context, threaded through recursion by the dispatcher.
 *
 * `bare` — true when the node renders inside a layout container (ColumnsBlock,
 * GridBlock) that already provides section/Container semantics. Adapters for
 * blocks with a `bare` prop read this to avoid double-wrapping.
 */
export type RenderContext = {
  readonly bare?: boolean
}

/**
 * One registry entry — the unit a deployment composes into its `Registry`.
 *
 * `TSchema` is the content shape this entry dispatches (a delivery body for
 * one schema URI); `TProps` is the component's prop contract. The adapter
 * between them lives here, at the renderer edge, so components stay free of
 * CMS envelope concerns (ADR-0009).
 */
export type ComponentRegistryEntry<TSchema = unknown, TProps = unknown> = {
  /** The React component this schema URI dispatches to. */
  readonly component: ComponentType<TProps>

  /**
   * Maps the content body to the component's props. Optional — when omitted
   * the dispatcher passes the content through as-is (identity adapter,
   * ADR-0010 §4). Receives the active `RenderContext` so nested blocks can
   * pick up layout cues (e.g. `bare`).
   */
  readonly propsFromSchema?: (schema: TSchema, ctx: RenderContext) => TProps

  /**
   * Optional renderer-edge validator (ADR-0009 §10). When present, the
   * dispatcher calls it before the adapter; a `false` return surfaces a
   * `PropsValidationFailure` card in place of the component.
   */
  readonly validate?: (schema: unknown) => schema is TSchema

  /**
   * For container entries (Page, Slot, ColumnsBlock, GridBlock): returns the
   * child content nodes nested under this node. The dispatcher renders them
   * recursively and passes the result to `component` as `children`. Leaf
   * entries omit this.
   */
  readonly getChildren?: (schema: TSchema) => readonly unknown[]

  /**
   * The `RenderContext` applied to children rendered via `getChildren`.
   * Layout containers set `{ bare: true }` so nested blocks drop their own
   * section wrappers.
   */
  readonly childContext?: RenderContext
}

/**
 * A registry entry with its generics erased — what registry *composition*
 * and the dispatcher's lookup see. The `any`s here are intentional and
 * contained (ADR-0010 §2): each entry's generic preserves type safety at
 * registration; the composed Map necessarily widens because entries for
 * different schemas have different shapes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponentRegistryEntry = ComponentRegistryEntry<any, any>

/** The registry a deployment passes to `renderContent`. */
export type Registry = ReadonlyMap<SchemaURI, AnyComponentRegistryEntry>

// ---------------------------------------------------------------------------
// Loud-failure classes (ADR-0010 §6)
// ---------------------------------------------------------------------------

/**
 * The content references a schema URI not present in the registry — most
 * likely a content-modelling bug, or an unresolved content-link stub when
 * the tree was fetched without `depth: 'all'`.
 */
export type SchemaUnknownFailure = {
  readonly failureClass: 'SchemaUnknown'
  readonly schemaUri: SchemaURI
  readonly registeredSchemas: readonly SchemaURI[]
  /** Extra context for special cases, e.g. an unresolved content-link. */
  readonly hint?: string
}

/**
 * The schema URI is in the registry but the entry has no `component` —
 * a registration-time bug; rare.
 */
export type ComponentUnregisteredFailure = {
  readonly failureClass: 'ComponentUnregistered'
  readonly schemaUri: SchemaURI
}

/**
 * The entry's `validate` predicate returned false, or `propsFromSchema` /
 * `getChildren` threw while adapting the content.
 */
export type PropsValidationFailure = {
  readonly failureClass: 'PropsValidationFailure'
  readonly schemaUri: SchemaURI
  readonly reason: 'validate-returned-false' | 'adapter-threw'
  readonly error?: unknown
}

/** Union of everything the dispatcher can emit when dispatch fails. */
export type RendererFailure =
  | SchemaUnknownFailure
  | ComponentUnregisteredFailure
  | PropsValidationFailure
