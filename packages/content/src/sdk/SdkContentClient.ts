/**
 * SdkContentClient — the real implementation of the ContentClient port
 * (QL-43), backed by `dc-delivery-sdk-js` against Content Delivery v2.
 *
 * Same surface, same return shape as the mock: the port promises the
 * delivery body with content-links resolved per `depth`, and CD2's
 * `content/fetch` endpoint provides exactly that — `depth: 'root'` leaves
 * reference stubs, `depth: 'all'` inlines them, `format: 'inlined'` keeps
 * the response a single document. The fetch endpoint also returns plain
 * JSON bodies (unlike `getContentItemByKey`, which wraps media references
 * in SDK helper classes), so what the renderer receives from this adapter
 * is byte-for-byte the shape the mock serves from fixtures.
 *
 * Error mapping (port contract, `ContentClientErrorKind`):
 *  - per-item `{ error }` entry in a 200 response → 'not-found'
 *  - HTTP 401/403                                 → 'unauthorised'
 *  - HTTP 404 (endpoint/hub level)                → 'not-found'
 *  - request never reached the API (DNS, refused,
 *    timeout — no response object)                → 'network'
 *  - response body that isn't the fetch shape     → 'malformed'
 *  - anything else                                → 'unknown'
 *
 * Configuration is data in, behaviour out: `makeSdkContentClient` takes a
 * resolved config object and never reads the environment itself —
 * `resolveContentConfig` (../config) owns that, per the ADR-0003 note on
 * keeping hub resolution in one place.
 */

import { ContentClient as DcContentClient } from 'dc-delivery-sdk-js'

import type { ContentClient } from '../port'
import type { ContentItem, ContentRequestOptions } from '../types'
import { ContentClientError } from '../types'

/** The SDK constructor's config union — used to borrow member types. */
type DcClientConfig = ConstructorParameters<typeof DcContentClient>[0]

/**
 * Resolved connection details for one hub. Hub name and staging host are
 * not credentials — CD2 and the VSE are public endpoints — but they are
 * commercially sensitive identifiers, so values belong in the operator's
 * own configuration (see ADR-0003 note), never hardcoded.
 */
export type SdkContentClientConfig = {
  /** Hub name, e.g. `quadraticlite` → `<hubName>.cdn.content.amplience.net`. */
  readonly hubName: string
  /**
   * Optional virtual-staging host (e.g. `…!.staging.bigcontent.io`). When
   * set, reads serve the latest saved versions instead of published ones —
   * local development against a hub that hasn't published yet, or
   * visualization rendering with a `vse` override.
   */
  readonly stagingHost?: string
  /** Optional locale passed through to the delivery API. */
  readonly locale?: string
  /**
   * Optional axios adapter override, passed straight through to the SDK.
   * Lets tests serve canned responses without any network.
   */
  readonly adaptor?: NonNullable<DcClientConfig>['adaptor']
}

/** The wire shape of one `content/fetch` response entry. */
type FetchResponseEntry = { content: unknown } | { error: unknown }

const isFetchResponse = (value: unknown): value is { responses: FetchResponseEntry[] } => {
  if (typeof value !== 'object' || value === null) return false
  const responses = (value as { responses?: unknown }).responses
  return Array.isArray(responses)
}

/** Structural sniff for errors the SDK throws (`HttpError`, `ContentNotFoundError`). */
const errorShape = (error: unknown): { name?: string; status?: number; code?: string } => {
  if (typeof error !== 'object' || error === null) return {}
  return error
}

/** Map an SDK/transport failure onto the port's typed error surface. */
const mapSdkError = (error: unknown, subject: string): ContentClientError => {
  const { name, status, code } = errorShape(error)

  if (name === 'CONTENT_NOT_FOUND') {
    return new ContentClientError('not-found', `${subject}: content not found.`, error)
  }
  if (name === 'HTTP_ERROR' && typeof status === 'number') {
    if (status === 401 || status === 403) {
      return new ContentClientError(
        'unauthorised',
        `${subject}: delivery API rejected the request (${status}).`,
        error,
      )
    }
    if (status === 404) {
      return new ContentClientError(
        'not-found',
        `${subject}: delivery endpoint not found (404) — check the hub name.`,
        error,
      )
    }
    return new ContentClientError(
      'unknown',
      `${subject}: delivery API request failed (${status}).`,
      error,
    )
  }
  // Axios surfaces transport failures without a `response`; the SDK rethrows
  // them untouched. `code` is set for DNS/refused/timeout failures.
  if (code !== undefined || (error instanceof Error && error.message === 'Network Error')) {
    return new ContentClientError(
      'network',
      `${subject}: could not reach the delivery API${code ? ` (${code})` : ''}.`,
      error,
    )
  }
  return new ContentClientError('unknown', `${subject}: unexpected content client failure.`, error)
}

export const makeSdkContentClient = (config: SdkContentClientConfig): ContentClient => {
  const sdk = new DcContentClient({
    hubName: config.hubName,
    ...(config.stagingHost !== undefined && { stagingEnvironment: config.stagingHost }),
    ...(config.locale !== undefined && { locale: config.locale }),
    ...(config.adaptor !== undefined && { adaptor: config.adaptor }),
  })

  const fetchOne = async <T>(
    request: { key: string } | { id: string },
    opts: ContentRequestOptions | undefined,
    subject: string,
  ): Promise<ContentItem<T>> => {
    let response: unknown
    try {
      // `content/fetch` rather than `getContentItemByKey/ById`: it honours
      // `depth` per request (the single-item methods always inline) and
      // returns plain JSON bodies (no media helper classes), matching the
      // port's return shape exactly.
      response = await sdk.fetchContentItems({
        requests: [request],
        parameters: { depth: opts?.depth ?? 'root', format: 'inlined' },
      })
    } catch (error) {
      throw mapSdkError(error, subject)
    }

    if (!isFetchResponse(response)) {
      throw new ContentClientError(
        'malformed',
        `${subject}: delivery API returned an unrecognisable response shape.`,
      )
    }
    const [entry] = response.responses
    if (!entry || !('content' in entry)) {
      throw new ContentClientError('not-found', `${subject}: no content matches.`)
    }
    return entry.content as ContentItem<T>
  }

  return {
    getByKey: <T = unknown>(key: string, opts?: ContentRequestOptions) =>
      fetchOne<T>({ key }, opts, `getByKey("${key}")`),

    getById: <T = unknown>(id: string, opts?: ContentRequestOptions) =>
      fetchOne<T>({ id }, opts, `getById("${id}")`),

    // TODO (QL-129): replace with real Filter API traversal.
    // Returning a rejected promise (rather than being absent) is intentional
    // and permanent: Promise.allSettled in layout.tsx degrades gracefully so
    // sites that don't use HierarchyMenu at all are unaffected.
    getHierarchy: <T = unknown>(_rootKey: string): Promise<ContentItem<T>> =>
      Promise.reject(
        new ContentClientError(
          'not-found',
          'getHierarchy is not yet implemented in SdkContentClient (QL-129).',
        ),
      ),
  }
}
