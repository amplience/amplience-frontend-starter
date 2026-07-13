/**
 * HierarchyMenuServer — async RSC that owns the `getHierarchy` fetch for any
 * HierarchyMenu content-link encountered in the component tree.
 *
 * When the header is fetched with `depth: 'all'`, a HierarchyMenu content-link
 * inside a HeaderRow resolves to its flat delivery body — schema fields only,
 * no `items`, because the hierarchy tree lives outside the standard content graph
 * and cannot be inlined by the fetch endpoint. This RSC reads the delivery key
 * from `_meta`, calls `client.getHierarchy`, and renders the assembled tree via
 * `renderContent` using a local sub-registry.
 *
 * The sub-registry maps `HIERARCHY_MENU_SCHEMA` back to the plain
 * `hierarchyMenuRegistryEntry` (not this RSC), so the inner render pass does
 * not loop back into another `getHierarchy` call.
 *
 * Registered as the `HIERARCHY_MENU_SCHEMA` component in `apps/web/lib/registry.ts`.
 * The plain entry from `@amplience/quadratic-components` stays in the default
 * registry and remains the correct choice when data is already assembled (e.g.
 * mock fixtures, or a direct `renderContent` call on a pre-fetched tree).
 */

import {
  createRegistry,
  HIERARCHY_MENU_ITEM_SCHEMA,
  HIERARCHY_MENU_SCHEMA,
  hierarchyMenuItemRegistryEntry,
  hierarchyMenuRegistryEntry,
} from '@amplience/quadratic-components/registry'

import { client } from '../../lib/content-client'
import { renderContent } from '../renderer'

/**
 * Sub-registry for the assembled hierarchy tree.
 *
 * `HIERARCHY_MENU_SCHEMA` points to the plain `hierarchyMenuRegistryEntry`
 * rather than this RSC, so inner dispatches render the assembled root directly
 * without triggering another `getHierarchy` call.
 */
const hierarchySubRegistry = createRegistry([
  [HIERARCHY_MENU_SCHEMA, hierarchyMenuRegistryEntry],
  [HIERARCHY_MENU_ITEM_SCHEMA, hierarchyMenuItemRegistryEntry],
])

/**
 * The only `_meta` fields this RSC needs.
 *
 * DC originally stored a single key as a flat `deliveryKey` string; later
 * releases added multi-key support via `deliveryKeys.values[]`. The
 * `fetchContentItems` (CD2) path returns the nested shape, but we handle
 * both defensively in case older content or a different SDK path returns
 * the flat form.
 */
type HierarchyMenuMeta = {
  /** Legacy single-key shape. */
  readonly deliveryKey?: string
  /** Current multi-key shape — `fetchContentItems` always returns this. */
  readonly deliveryKeys?: {
    readonly values?: readonly { readonly value: string }[]
  }
}

/**
 * Props received from the dispatcher — the full delivery body of the
 * HierarchyMenu content item as resolved by `depth: 'all'` on the header.
 * Includes `_meta` (with `deliveryKey`) plus the schema fields themselves.
 * The registry entry omits `propsFromSchema`, so `_meta` is not stripped.
 */
type HierarchyMenuStub = {
  readonly _meta: HierarchyMenuMeta
  /**
   * Active locale URL prefix (ADR-0015), injected by the deployment registry
   * entry from the render context. Threaded into the inner `renderContent`
   * pass so the assembled nav's links stay inside the current locale — the
   * hierarchy tree is fetched and rendered here, outside the parent render, so
   * the context has to be handed across the boundary explicitly.
   */
  readonly localeBasePath?: string
  readonly [key: string]: unknown
}

export async function HierarchyMenuServer(props: HierarchyMenuStub) {
  const rootKey = props._meta.deliveryKeys?.values?.[0]?.value ?? props._meta.deliveryKey

  if (!rootKey) {
    console.warn('[HierarchyMenuServer] HierarchyMenu has no deliveryKey — skipping render')
    return null
  }

  let assembled: unknown
  try {
    assembled = await client.getHierarchy(rootKey)
  } catch {
    // `getHierarchy` rejects if the key doesn't exist or the fetch fails.
    // Degrade silently — a broken nav should not crash every page.
    return null
  }

  return renderContent(assembled, hierarchySubRegistry, {
    localeBasePath: props.localeBasePath ?? '',
  })
}
