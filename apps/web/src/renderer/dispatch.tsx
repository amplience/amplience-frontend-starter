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

import { isContentLink } from '@amplience/frontend-starter-content'
import type {
  MediaLoadPriority,
  Registry,
  RenderContext,
  RendererFailure,
  SchemaURI,
} from '@amplience/frontend-starter-types'

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

/**
 * One step down the ladder: the LCP candidate's neighbour still loads eagerly,
 * and everything below that lazy-loads. Shared by the two things that spend a
 * step — sibling position, and a container that consumed the tier for media of
 * its own.
 */
const demoteOneStep = (tier: MediaLoadPriority | undefined): MediaLoadPriority =>
  tier === 'lcp' ? 'eager' : 'lazy'

/**
 * The `loadPriority` tier for the sibling at `index`, given the tier the group
 * as a whole carries (ADR-0021 §2).
 *
 * Siblings in a content array are a vertical stack, so the index is a proxy for
 * distance from the top of the page. The first keeps the tier it was given; the
 * second drops one step, which is what turns a page's leading edge into an LCP
 * candidate followed by an above-the-fold-but-not-LCP block; everything after
 * the second is far enough down to lazy-load.
 *
 * Demoting rather than clearing at index 1 is the whole point: exactly one node
 * per page reaches `'lcp'` — so there is never more than one preload competing
 * for early bandwidth — while the block most likely to be in the first viewport
 * without being the LCP still loads eagerly instead of being discovered late.
 *
 * The rule is positional, so a container laying its children out side by side
 * (a row of columns, a grid) demotes them as though they were stacked. That
 * under-eagers the second and third column of an `'eager'` row, which is the
 * safe direction to be wrong in; a container that knows its own geometry can
 * override this through `childContextFromSchema`.
 */
const demote = (tier: MediaLoadPriority | undefined, index: number): MediaLoadPriority => {
  if (tier === undefined) return 'lazy'
  if (index === 0) return tier
  if (index === 1) return demoteOneStep(tier)
  return 'lazy'
}

/**
 * The card each failure class renders, keyed by the discriminant.
 *
 * A keyed table rather than a `switch` with a `never` guard: the mapped type
 * makes a new failure class a compile error at the table itself, so
 * exhaustiveness is checked where the cards are declared instead of at an
 * unreachable `default` branch. The guard form costs a permanently uncovered
 * line and branch — `mediaLoadingProps` in ContentMedia names this function as
 * the counter-example; it no longer is one.
 *
 * Each entry keeps its narrowed prop type, so a card wired to the wrong
 * failure class is still a compile error.
 */
const CARD_BY_FAILURE_CLASS: {
  [K in RendererFailure['failureClass']]: ComponentType<{
    failure: Extract<RendererFailure, { failureClass: K }>
  }>
} = {
  SchemaUnknown: SchemaUnknownCard,
  ComponentUnregistered: ComponentUnregisteredCard,
  PropsValidationFailure: PropsValidationFailureCard,
}

/** Emit the console signal and render the matching failure card. */
const fail = (failure: RendererFailure, content: unknown): ReactNode => {
  emitRendererFailure(failure, content)
  // The table is keyed by the same discriminant being read, so the looked-up
  // card always matches this failure. TypeScript can't correlate the two
  // through a union-typed index, hence the assertion.
  const Card = CARD_BY_FAILURE_CLASS[failure.failureClass] as ComponentType<{
    failure: RendererFailure
  }>
  return <Card failure={failure} />
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

  // Structural guard — array node: render each element in order. Siblings are
  // a vertical stack, so each one's media loads a step less urgently than the
  // one above it (see `demote`).
  if (Array.isArray(content)) {
    return content.map((node, i) => {
      const childCtx: RenderContext = { ...ctx, loadPriority: demote(ctx.loadPriority, i) }
      return <Fragment key={keyOf(node, i)}>{renderContent(node, registry, childCtx)}</Fragment>
    })
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
    ((schema: unknown, ctx: RenderContext) => unknown) | undefined
  const validate = entry.validate as ((schema: unknown) => boolean) | undefined
  const getChildren = entry.getChildren as ((schema: unknown) => readonly unknown[]) | undefined
  const childContextFromSchema = entry.childContextFromSchema as
    ((schema: unknown, ctx: RenderContext) => RenderContext) | undefined

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

    // A container near the page's leading edge passes its `loadPriority` down
    // into its children (the array branch above then demotes it per sibling),
    // spending a step first if it rendered media of its own. `'lazy'` is the
    // default, so forwarding it explicitly would only let a container's own
    // childContext be overridden by a tier that says nothing — hence the guard.
    //
    // The entry's static childContext supplies constant cues (e.g. `bare`);
    // childContextFromSchema layers on any derived from this node's content
    // (e.g. `slotSizes` from the column geometry) and goes last, so a container
    // that knows its own geometry can override an inherited cue rather than
    // having it reapplied over the top.
    const forwardedTier =
      entry.consumesLoadPriority === true ? demoteOneStep(ctx.loadPriority) : ctx.loadPriority
    const childCtx: RenderContext = {
      ...(entry.childContext ?? {}),
      ...(forwardedTier !== undefined &&
        forwardedTier !== 'lazy' && { loadPriority: forwardedTier }),
      ...(childContextFromSchema?.(content, ctx) ?? {}),
      // Locale is a whole-tree property (ADR-0015), so it always flows to
      // children — unlike `loadPriority`, which decays with distance from the
      // top of the page.
      ...(ctx.localeBasePath !== undefined && { localeBasePath: ctx.localeBasePath }),
    }
    const children = renderContent(getChildren(content), registry, childCtx)
    return createElement(component, props, children)
  } catch (error) {
    return fail(
      { failureClass: 'PropsValidationFailure', schemaUri, reason: 'adapter-threw', error },
      content,
    )
  }
}
