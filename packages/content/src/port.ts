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

export type ContentClient = {
  /**
   * Fetch a content item by its delivery key (e.g. `"acme/homepage"`,
   * `"acme/blog/welcome"`). Returns the delivery shape — body with `_meta`,
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

  /**
   * List all published content items whose `_meta.schema` matches `schemaId`.
   * Backed by the DC Delivery Filter API in the SDK adapter and by a
   * schema-URI filter over in-memory fixtures in the mock.
   *
   * Pagination is handled internally — the returned array contains every
   * matching item across all pages. Suitable for listing-style routes (the
   * `/blog` archive) and `generateStaticParams` enumeration in SSG routes.
   *
   * Items are returned at `depth: 'root'` — content-link references are left
   * as stubs. Callers that need the full tree for a specific item should
   * follow up with `getByKey` / `getById`.
   */
  listBySchema<T = unknown>(schemaId: string): Promise<readonly ContentItem<T>[]>

  /**
   * Fetch a hierarchy content item by its root delivery key and assemble the
   * full tree inline — children are injected under `items` (root) and
   * `children` (nodes), matching the shape that `depth: 'all'` produces for
   * array-based Menu content. This lets the existing dispatcher and registry
   * entries work without modification.
   *
   * Used for HierarchyMenu content types. The mock implementation reads a
   * static hierarchy manifest; the SDK implementation (QL-129) will use the
   * dc-delivery-sdk-js Filter API.
   *
   * Throws `ContentClientError({ kind: 'not-found' })` if no hierarchy matches
   * the given root key.
   */
  getHierarchy<T = unknown>(rootKey: string): Promise<ContentItem<T>>
}
