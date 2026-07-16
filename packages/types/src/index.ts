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
 *
 * `isTopOfPage` — true while rendering the page's leading edge: the root
 * node and, within each container along that edge, its first child. The
 * flag therefore reaches exactly the first block on a page (or the first
 * block in the first slot, when slots are present). Adapters for blocks
 * that render images read this so above-the-fold imagery loads eagerly
 * while everything below the fold keeps lazy loading.
 */
export type RenderContext = {
  readonly bare?: boolean
  readonly isTopOfPage?: boolean
  /**
   * URL prefix for the active locale (ADR-0015) — `''` for the default
   * (unprefixed) locale, `/fr-fr` otherwise. Threaded through the whole tree
   * so the `Link` atom can keep internal navigation inside the current locale
   * without every component re-deriving it. Set once at the render entry;
   * the dispatcher forwards it to every child context.
   */
  readonly localeBasePath?: string
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
  SchemaUnknownFailure | ComponentUnregisteredFailure | PropsValidationFailure

// ---------------------------------------------------------------------------
// Amplience media types (QL-65)
// ---------------------------------------------------------------------------

/**
 * Resolved Amplience image-link — the raw reference returned by DC delivery
 * for an image-link field.
 * Mirrors http://bigcontent.io/cms/schema/v1/core#/definitions/image-link
 */
export type AmplienceImageLink = {
  readonly name: string
  readonly endpoint: string
  readonly defaultHost: string
  readonly id?: string
}

/**
 * The delivery shape of a field using the image-poi extension.
 * The extension bakes all DI transform params into `query` at authoring time,
 * and writes the asset's dimensions alongside them, so the payload is fully
 * self-describing — renderers never fetch the DI metadata endpoint.
 * The renderer only needs image (for base URL), query (for transforms), and
 * width/height/aspectRatio (for CSS box sizing — all describing the
 * DELIVERED image, crop applied when one is drawn).
 * Other fields the extension stores (crop coordinates, poi coordinates, rot,
 * hue, aspectLock, etc.) are present in the delivery payload but are already
 * encoded into `query` or reflected in the delivered dimensions, and do not
 * need to be read by the renderer.
 */
export type TransformedImageField = {
  readonly image: AmplienceImageLink
  /** Pre-baked DI query string — everything except `w=`. E.g. "?sm=aspect&aspect=16:9" */
  readonly query?: string
  /** DELIVERED image width in px (crop applied when drawn), written by the extension at authoring time. */
  readonly width?: number
  /** DELIVERED image height in px (crop applied when drawn), written by the extension at authoring time. */
  readonly height?: number
  /**
   * The DELIVERED image's aspect ratio as a decimal (e.g. 1.7264), written
   * by the extension at authoring time — always consistent with `width` /
   * `height` above. Preferred sizing source for renderers. Optional: content
   * authored before the extension change carries none of the dimension
   * fields.
   */
  readonly aspectRatio?: number
}

/**
 * ManualImage mode — a direct URL with intrinsic dimensions entered by the author.
 * Maps to the <ManualImage> molecule.
 */
export type ManualImageData = {
  readonly mediaType: 'ManualImage'
  readonly image: {
    readonly src: string
    readonly alt: string
    readonly width: number
    readonly height: number
    /** Optional CSS aspect-ratio override e.g. "16 / 9" (CSS slash format). */
    readonly aspectRatio?: string
  }
}

/**
 * DynamicImage mode — a DAM asset picked via the image-poi extension.
 * Maps to the <DynamicImage> molecule.
 *
 * `image` is the full image-poi field delivered by DC: base image-link plus
 * pre-baked DI transforms (crop, POI, smart scaling) in `query`, and the
 * DELIVERED image's dimensions/ratio written by the extension.
 * The renderer appends fmt=webp&w={width} via the DI loader for responsive srcset.
 */
export type DynamicImageData = {
  readonly mediaType: 'DynamicImage'
  /** Full image-poi field — base image-link plus pre-baked DI transforms. */
  readonly image: TransformedImageField
  /** Alt text pre-populated from DAM by automated-alt-text extension, author-overridable */
  readonly imageAltText?: string
}

/**
 * Union of all media modes, discriminated by mediaType.
 * Accepted by <ContentMedia> and used as the media prop type by all blocks.
 *
 * Currently: ManualImage | DynamicImage.
 * Future: DynamicVideo | ExternalVideo | BynderImage | …
 */
export type ContentMediaData = ManualImageData | DynamicImageData
