/**
 * Content type definitions for @amplience/quadratic-content.
 *
 * Two shapes live here that look similar but mean different things:
 *
 *  - `EnrichedContentItem<T>` — the on-disk fixture shape. Matches dc-cli's
 *    enriched content-item export format: a thin `{ id, label, body }` envelope
 *    where `body` is what the delivery API returns. The mock loader reads these.
 *
 *  - `ContentItem<T>` — what the `ContentClient` port returns to consumers.
 *    The body, with content-links optionally resolved depending on `depth`.
 *    Consumers (the renderer, pages, components) only see this shape.
 *
 * The split keeps "how fixtures look on disk" decoupled from "what the renderer
 * receives at runtime", and matches the dc-delivery-sdk-js return shape on the
 * consumer side so the SDK adapter (QL-43) is a drop-in.
 */

/** The schema URI Amplience uses to mark a content-link reference stub. */
export const CONTENT_LINK_SCHEMA =
  'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'

/** The Amplience content envelope `_meta`. Schema URI is the dispatch key. */
export type ContentMeta = {
  readonly schema: string
  readonly name?: string
  readonly deliveryId?: string
  readonly deliveryKeys?: {
    readonly values: readonly { readonly value: string }[]
  }
}

/**
 * A content-link reference stub — what a content-item body holds when it
 * references another content-item. The dispatcher recognises these by the
 * `_meta.schema` value and resolves them via the loader's id map when
 * `depth: 'all'` is requested.
 */
export type ContentLink = {
  readonly id: string
  readonly contentType: string
  readonly _meta: { readonly schema: typeof CONTENT_LINK_SCHEMA }
}

/**
 * The dc-cli enriched envelope — what every JSON file under `fixtures/`
 * conforms to. The `body` is the delivery shape; the envelope is purely
 * management-side metadata that round-trips with dc-cli imports.
 */
export type EnrichedContentItem<TBody = unknown> = {
  readonly id: string
  readonly label?: string
  readonly body: ContentBody<TBody>
}

/**
 * A content-item body — the delivery-shape payload. `_meta` carries the
 * schema URI (dispatch key) and optional delivery-key lookup info.
 * Everything else is type-specific content.
 */
export type ContentBody<TExtra = unknown> = TExtra & {
  readonly _meta: ContentMeta
}

/**
 * What the `ContentClient` port returns. Shape matches the delivery API
 * response — just the body, with content-links either inlined (depth: 'all')
 * or left as stubs (depth: 'root').
 */
export type ContentItem<TBody = unknown> = ContentBody<TBody>

/** Options that apply to any read. Mirrors the surface in ADR-0008. */
export type ContentRequestOptions = {
  /**
   * Resolve nested content-link references inline (`'all'`) or leave them as
   * reference stubs (`'root'`). Defaults to `'root'` to match the Amplience
   * delivery API's default.
   */
  readonly depth?: 'root' | 'all'
}

/** Discriminator for typed errors emitted by any ContentClient implementation. */
export type ContentClientErrorKind =
  | 'not-found'
  | 'unauthorised'
  | 'network'
  | 'malformed'
  | 'unknown'

/**
 * Typed error surface for ContentClient failures. The renderer's loud-failure
 * mode (ADR-0010) discriminates on `kind` to choose the right card.
 */
export class ContentClientError extends Error {
  public readonly kind: ContentClientErrorKind
  public override readonly cause?: unknown

  constructor(kind: ContentClientErrorKind, message: string, cause?: unknown) {
    super(message)
    this.name = 'ContentClientError'
    this.kind = kind
    if (cause !== undefined) this.cause = cause
  }
}

/** True if `value` is a content-link reference stub. */
export const isContentLink = (value: unknown): value is ContentLink => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v['id'] !== 'string') return false
  if (typeof v['contentType'] !== 'string') return false
  const meta = v['_meta']
  if (typeof meta !== 'object' || meta === null) return false
  return (meta as Record<string, unknown>)['schema'] === CONTENT_LINK_SCHEMA
}
