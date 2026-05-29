/**
 * The ContentClient port — the integration seam established by ADR-0008.
 *
 * Components, pages, and the renderer depend on this interface, never on a
 * concrete implementation. POC ships one implementation (MockContentClient,
 * this package's `./mock`); QL-43 lands the SDK-backed adapter. Brand
 * overrides and the future visualization client implement the same port.
 *
 * Read-only on purpose — writes are management-SDK territory and live in
 * `packages/automation` (per ADR-0008 open question #11).
 */

import type { ContentItem, ContentRequestOptions } from './types'

export interface ContentClient {
  /**
   * Fetch a content item by its delivery key (e.g. `"home"`,
   * `"blog/welcome"`). Returns the delivery shape — body with `_meta`,
   * content-links resolved per `opts.depth`.
   *
   * Throws `ContentClientError({ kind: 'not-found' })` if no item matches.
   */
  getByKey<T = unknown>(key: string, opts?: ContentRequestOptions): Promise<ContentItem<T>>

  /**
   * Fetch a content item by its delivery ID (UUID). Same return shape as
   * `getByKey`. Used by the resolver to walk content-link references when
   * `depth: 'all'` is requested, and available to consumers that already
   * hold an ID.
   *
   * Throws `ContentClientError({ kind: 'not-found' })` if no item matches.
   */
  getById<T = unknown>(id: string, opts?: ContentRequestOptions): Promise<ContentItem<T>>
}
