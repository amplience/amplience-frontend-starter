/**
 * MockContentClient — the POC implementation of the ContentClient port.
 *
 * Reads from the static fixture set in `../../fixtures/base-site/` (loaded
 * via `./loader`), returns the delivery shape (just the `body` portion of
 * the dc-cli enriched envelope), and resolves content-links inline when the
 * caller asks for `depth: 'all'`.
 *
 * What the real SDK adapter (QL-43) will do differently:
 *  - Hit `dc-delivery-sdk-js` instead of the local fixture map.
 *  - Honour `revalidate` / `tags` (Next.js fetch cache pass-through).
 *  - Handle locale resolution per Amplience's locale-group rules.
 *  - Map SDK errors onto `ContentClientError` kinds.
 *
 * Same port surface, same return shape — swap-in is one line in
 * `apps/web`'s composition.
 */

import hierarchyManifests from '../../fixtures/_hierarchy/manifests.json' with { type: 'json' }
import type { ContentClient } from '../port'
import type { ContentItem, ContentRequestOptions, EnrichedContentItem } from '../types'
import { ContentClientError } from '../types'
import { findById, findByKey } from './loader'
import { resolveDeep } from './resolver'

/**
 * Shape of a single hierarchy manifest entry.
 * `root` is the delivery ID of the root node.
 * `children` maps each node ID to an ordered list of its direct child IDs.
 */
type HierarchyManifest = {
  readonly root: string
  readonly children: Readonly<Record<string, readonly string[]>>
}

const toContentItem = <T>(
  item: EnrichedContentItem,
  opts: ContentRequestOptions | undefined,
): ContentItem<T> => {
  const body = opts?.depth === 'all' ? resolveDeep(item.body, findById) : item.body
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
): unknown => {
  const item = findById(id)
  if (!item) return undefined

  const childIds = manifest.children[id] ?? []
  if (childIds.length === 0) return item.body

  const assembledChildren = childIds
    .map((childId) => assembleHierarchyNode(childId, manifest, false))
    .filter((c): c is unknown => c !== undefined)

  return {
    ...item.body,
    // Root uses `items` (HierarchyMenu registry getChildren);
    // non-root nodes use `children` (HierarchyMenuItem registry getChildren).
    ...(isRoot ? { items: assembledChildren } : { children: assembledChildren }),
  }
}

export const makeMockContentClient = (): ContentClient => ({
  getByKey: <T = unknown>(key: string, opts?: ContentRequestOptions): Promise<ContentItem<T>> => {
    const item = findByKey(key)
    if (!item) {
      return Promise.reject(
        new ContentClientError('not-found', `No fixture matches delivery key "${key}".`),
      )
    }
    return Promise.resolve(toContentItem<T>(item, opts))
  },

  getById: <T = unknown>(id: string, opts?: ContentRequestOptions): Promise<ContentItem<T>> => {
    const item = findById(id)
    if (!item) {
      return Promise.reject(
        new ContentClientError('not-found', `No fixture matches delivery id "${id}".`),
      )
    }
    return Promise.resolve(toContentItem<T>(item, opts))
  },

  getHierarchy: <T = unknown>(rootKey: string): Promise<ContentItem<T>> => {
    const manifest = (hierarchyManifests as Record<string, HierarchyManifest>)[rootKey]
    if (!manifest) {
      return Promise.reject(
        new ContentClientError(
          'not-found',
          `No hierarchy manifest for delivery key "${rootKey}". ` +
            `Add an entry to packages/content/fixtures/_hierarchy/manifests.json.`,
        ),
      )
    }
    const assembled = assembleHierarchyNode(manifest.root, manifest, true)
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
})
