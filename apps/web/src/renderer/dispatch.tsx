/**
 * The renderer dispatcher (ADR-0010) — recursive dispatch over a content
 * tree, with loud failure on every axis.
 *
 * The public entry point is `renderContent(content, registry)`. The registry
 * is a plain value threaded through recursion (argument-passing, Axis 1B):
 * no hooks, no context, no browser APIs — the renderer runs as a Server
 * Component all the way down.
 *
 * Dispatch is keyed by `_meta.schema` (no aliasing, §3). Container entries
 * declare `getChildren`; the dispatcher renders those child nodes
 * recursively and passes the result to the component as `children` — one
 * recursion mechanism for pages, slots, and layout blocks alike. Structural
 * guards (array nodes, missing `_meta.schema`, unresolved content-links)
 * protect the dispatcher from malformed input; everything schema-shaped
 * resolves through the registry.
 *
 * Every failure exit renders a card in place (§5B) — the rest of the page
 * renders normally — and emits a structured console signal (§8).
 */

import { createElement, Fragment, type ComponentType, type ReactNode } from 'react'

import { isContentLink } from '@amplience/quadratic-content'
import type {
  Registry,
  RenderContext,
  RendererFailure,
  SchemaURI,
} from '@amplience/quadratic-types'

import { emitRendererFailure } from './console'
import { ComponentUnregisteredCard } from './failure/ComponentUnregisteredCard'
import { PropsValidationFailureCard } from './failure/PropsValidationFailureCard'
import { SchemaUnknownCard } from './failure/SchemaUnknownCard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable React key for a node — deliveryId when resolved, index otherwise. */
const keyOf = (node: unknown, index: number): string => {
  const meta = (node as { _meta?: { deliveryId?: unknown } } | null)?._meta
  return typeof meta?.deliveryId === 'string' ? meta.deliveryId : `node-${index}`
}

const registeredSchemas = (registry: Registry): readonly SchemaURI[] => [...registry.keys()]

/** Emit the console signal and render the matching failure card. */
const fail = (failure: RendererFailure, content: unknown): ReactNode => {
  emitRendererFailure(failure, content)
  switch (failure.failureClass) {
    case 'SchemaUnknown':
      return <SchemaUnknownCard failure={failure} />
    case 'ComponentUnregistered':
      return <ComponentUnregisteredCard failure={failure} />
    case 'PropsValidationFailure':
      return <PropsValidationFailureCard failure={failure} />
    default: {
      // Exhaustiveness guard — a new failure class is a compile error here.
      const exhaustive: never = failure
      return exhaustive
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Render a content tree against a registry. `content` is any node of the
 * tree — a full page body, a slot, a single component, or an array of any
 * of these. Returns the rendered tree, with a failure card in place of any
 * node that could not be dispatched.
 */
export function renderContent(
  content: unknown,
  registry: Registry,
  ctx: RenderContext = {},
): ReactNode {
  if (content == null) return null

  // Structural guard — array node: render each element in order.
  if (Array.isArray(content)) {
    return content.map((node, i) => (
      <Fragment key={keyOf(node, i)}>{renderContent(node, registry, ctx)}</Fragment>
    ))
  }

  // Structural guard — unresolved content-link stub: the tree was fetched
  // without depth='all', or the reference points outside the fetched set.
  if (isContentLink(content)) {
    return fail(
      {
        failureClass: 'SchemaUnknown',
        schemaUri: content.contentType,
        registeredSchemas: registeredSchemas(registry),
        hint: "This reference was not resolved — fetch the tree with depth: 'all', or check that the referenced item exists.",
      },
      content,
    )
  }

  // Structural guard — a node with no dispatch key.
  const meta = (content as { _meta?: { schema?: unknown } })._meta
  const schemaUri = typeof meta?.schema === 'string' ? meta.schema : undefined
  if (schemaUri === undefined) {
    return fail(
      {
        failureClass: 'SchemaUnknown',
        schemaUri: '(missing _meta.schema)',
        registeredSchemas: registeredSchemas(registry),
      },
      content,
    )
  }

  // Registry lookup. The entry's per-registration generics are erased here
  // (ADR-0010 §2) — widen its members to safe shapes once, at this boundary.
  const entry = registry.get(schemaUri)
  if (entry === undefined) {
    return fail(
      { failureClass: 'SchemaUnknown', schemaUri, registeredSchemas: registeredSchemas(registry) },
      content,
    )
  }

  const component = entry.component as ComponentType<Record<string, unknown>> | undefined
  const adapt = entry.propsFromSchema as
    | ((schema: unknown, ctx: RenderContext) => unknown)
    | undefined
  const validate = entry.validate as ((schema: unknown) => boolean) | undefined
  const getChildren = entry.getChildren as ((schema: unknown) => readonly unknown[]) | undefined

  if (component == null) {
    return fail({ failureClass: 'ComponentUnregistered', schemaUri }, content)
  }

  if (validate !== undefined && !validate(content)) {
    return fail(
      { failureClass: 'PropsValidationFailure', schemaUri, reason: 'validate-returned-false' },
      content,
    )
  }

  // Happy path: adapt props (identity when no adapter, §4), render children
  // for container entries, dispatch.
  try {
    const props = (adapt === undefined ? content : adapt(content, ctx)) as Record<string, unknown>
    if (getChildren === undefined) return createElement(component, props)

    const children = renderContent(getChildren(content), registry, entry.childContext ?? {})
    return createElement(component, props, children)
  } catch (error) {
    return fail(
      { failureClass: 'PropsValidationFailure', schemaUri, reason: 'adapter-threw', error },
      content,
    )
  }
}
