/**
 * MockContentClient — the POC implementation of the ContentClient port.
 *
 * Reads from the static fixture set in `../../fixtures/frontend-starter/` (loaded
 * via `./loader`), returns the delivery shape (just the `body` portion of
 * the dc-cli enriched envelope), and resolves content-links inline when the
 * caller asks for `depth: 'all'`.
 *
 * What the real SDK adapter (QL-43) will do differently:
 *  - Hit `dc-delivery-sdk-js` instead of the local fixture map.
 *  - Honour `revalidate` / `tags` (Next.js fetch cache pass-through).
 *  - Map SDK errors onto `ContentClientError` kinds.
 *
 * Locale resolution is one behaviour the mock now shares with the adapter:
 * given a request `locale`, both collapse field-level localized values to the
 * single matching value (`./localized` here, the Delivery API there).
 *
 * Same port surface, same return shape — swap-in is one line in
 * `apps/web`'s composition.
 */

import { resolveLocalized } from '../localized'
import type { ContentClient } from '../port'
import type { ContentItem, ContentRequestOptions, EnrichedContentItem } from '../types'
import { ContentClientError } from '../types'
import { DEFAULT_FIXTURE_SET, resolveFixtureSet } from './loader'
import { resolveDeep } from './resolver'
import type { HierarchyManifest } from './set'

const toContentItem = <T>(
  item: EnrichedContentItem,
  opts: ContentRequestOptions | undefined,
  findById: (id: string) => EnrichedContentItem | undefined,
): ContentItem<T> => {
  const resolved = opts?.depth === 'all' ? resolveDeep(item.body, findById) : item.body
  // Collapse localized fields only when a locale is requested — matching the
  // Delivery API, which returns the raw `{ values }` object with no locale.
  const body = opts?.locale !== undefined ? resolveLocalized(resolved, opts.locale) : resolved
  return body as ContentItem<T>
}

// The mock is genuinely synchronous — fixtures are loaded at module-init time
// and lookups hit in-memory maps. The methods are typed as `Promise<T>` to
// satisfy the `ContentClient` port (real adapters do I/O), so we wrap the
// result in `Promise.resolve` / `Promise.reject` rather than using `async`,
// which would lie about the implementation and trip `require-await`.

/**
 * Recursively assemble a hierarchy tree from the manifest.
 *
 * The root node gets its children injected under `items` (matching the
 * HierarchyMenu registry entry's `getChildren`). All other nodes get their
 * children injected under `children` (matching HierarchyMenuItem's
 * `getChildren`). Leaf nodes (no children in the manifest) are returned as-is.
 *
 * This mirrors what `resolveDeep` + `depth: 'all'` does for array-based Menu
 * content, so the dispatcher works without modification.
 */
const assembleHierarchyNode = (
  id: string,
  manifest: HierarchyManifest,
  isRoot: boolean,
  findById: (id: string) => EnrichedContentItem | undefined,
): unknown => {
  const item = findById(id)
  if (!item) return undefined

  const childIds = manifest.children[id] ?? []
  if (childIds.length === 0) return item.body

  const assembledChildren = childIds
    .map((childId) => assembleHierarchyNode(childId, manifest, false, findById))
    .filter((c): c is unknown => c !== undefined)

  return {
    ...item.body,
    // Root uses `items` (HierarchyMenu registry getChildren);
    // non-root nodes use `children` (HierarchyMenuItem registry getChildren).
    ...(isRoot ? { items: assembledChildren } : { children: assembledChildren }),
  }
}

/**
 * @param setName which fixture set to serve — the site name a mock deployment
 *   resolves to (ADR-0019). Throws at composition on an unknown set.
 */
export const makeMockContentClient = (setName: string = DEFAULT_FIXTURE_SET): ContentClient => {
  const { fixtures, hierarchies, findById, findByKey } = resolveFixtureSet(setName)

  return {
    getByKey: <T = unknown>(key: string, opts?: ContentRequestOptions): Promise<ContentItem<T>> => {
      const item = findByKey(key)
      if (!item) {
        return Promise.reject(
          new ContentClientError('not-found', `No fixture matches delivery key "${key}".`),
        )
      }
      return Promise.resolve(toContentItem<T>(item, opts, findById))
    },

    getById: <T = unknown>(id: string, opts?: ContentRequestOptions): Promise<ContentItem<T>> => {
      const item = findById(id)
      if (!item) {
        return Promise.reject(
          new ContentClientError('not-found', `No fixture matches delivery id "${id}".`),
        )
      }
      return Promise.resolve(toContentItem<T>(item, opts, findById))
    },

    listBySchema: <T = unknown>(
      schemaId: string,
      opts?: Pick<ContentRequestOptions, 'locale'>,
    ): Promise<readonly ContentItem<T>[]> => {
      // Filter fixtures whose body schema URI matches. Returns bodies at
      // depth: 'root' (stubs left as-is) — consistent with the SDK adapter
      // which uses the Filter API's default depth behaviour. Localized fields
      // collapse only when a locale is requested (as the Delivery API does).
      // Scoped to this set: a hub serving two sites doesn't leak one's blog
      // posts into the other's archive.
      const matches = fixtures
        .filter((f) => {
          const meta = f.body._meta as { schema?: string } | undefined
          return meta?.schema === schemaId
        })
        .map((f) =>
          opts?.locale !== undefined
            ? (resolveLocalized(f.body, opts.locale) as ContentItem<T>)
            : (f.body as ContentItem<T>),
        )
      return Promise.resolve(matches)
    },

    getHierarchy: <T = unknown>(rootKey: string): Promise<ContentItem<T>> => {
      const manifest = hierarchies[rootKey]
      if (!manifest) {
        return Promise.reject(
          new ContentClientError(
            'not-found',
            `No hierarchy manifest for delivery key "${rootKey}" in fixture set ` +
              `"${setName}". Add an entry to packages/content/fixtures/${setName}/` +
              '_hierarchy/manifests.json.',
          ),
        )
      }
      const assembled = assembleHierarchyNode(manifest.root, manifest, true, findById)
      if (!assembled) {
        return Promise.reject(
          new ContentClientError(
            'not-found',
            `Hierarchy manifest root ID "${manifest.root}" has no matching fixture.`,
          ),
        )
      }
      return Promise.resolve(assembled as ContentItem<T>)
    },
  }
}
