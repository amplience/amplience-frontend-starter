/**
 * The deployment's component registry (ADR-0010 §3A).
 *
 * Composition is the deployment's act — the library provides the building
 * blocks and three routes, in increasing order of selectivity:
 *
 * 1. Everything — `defaultRegistry` as-is:
 *      export const registry: Registry = defaultRegistry
 *
 * 2. Only what you pick — `createRegistry` with entries à la carte:
 *
 *      export const registry: Registry = createRegistry([
 *        [HERO_BLOCK_SCHEMA, heroBlockRegistryEntry],
 *        [PAGE_SCHEMA, pageRegistryEntry],
 *        [SLOT_SCHEMA, slotRegistryEntry],
 *      ])
 *
 * 3. Everything apart from a few — `createRegistryWithout` subtracts from a
 *    base registry (a typo'd exclusion throws at module load rather than
 *    silently doing nothing):
 *
 *      export const registry: Registry = createRegistryWithout(defaultRegistry, [
 *        GRID_BLOCK_SCHEMA,
 *        MEDIA_CARD_SCHEMA,
 *      ])
 *
 * Schema URI constants, entries, and both helpers are all exported from
 * '@amplience/frontend-starter-components/registry'. The helpers exist because a
 * bare `new Map(...)` anchors its value type on the first entry and rejects
 * entries for other schemas.
 */

import {
  defaultRegistry,
  HIERARCHY_MENU_SCHEMA,
  LOCALE_SELECTOR_SCHEMA,
} from '@amplience/frontend-starter-components/registry'
import type { AnyComponentRegistryEntry, Registry } from '@amplience/frontend-starter-types'

import { HierarchyMenuServer } from '../src/components/HierarchyMenuServer'
import { LocaleSelectorConfigured } from '../src/components/LocaleSelectorConfigured'

/**
 * HierarchyMenu is the one entry the deployment overrides.
 *
 * The default `hierarchyMenuRegistryEntry` expects `items` to already be
 * assembled inline — correct for the mock (fixtures) and for any pre-fetched
 * tree, but not for the header render path where HierarchyMenu arrives as a
 * flat content-link stub (no `items`). `HierarchyMenuServer` is an async RSC
 * that reads `_meta.deliveryKey` from the stub and calls `client.getHierarchy`
 * itself, so the fetch happens at the point of render rather than up-front in
 * layout.tsx.
 *
 * `propsFromSchema` keeps the full content body (the component needs `_meta`
 * for the delivery key) and adds `localeBasePath` from the render context, so
 * the async subtree fetched by `HierarchyMenuServer` can carry the active
 * locale into its own `renderContent` pass (ADR-0015) — the one link surface
 * the parent tree's context can't reach on its own.
 *
 * `getChildren` is deliberately omitted: the stub has no `items`, and
 * `HierarchyMenuServer` handles its own subtree after fetching.
 */
const hierarchyMenuServerEntry: AnyComponentRegistryEntry = {
  component: HierarchyMenuServer,
  propsFromSchema: (schema, ctx) => ({
    ...(schema as Record<string, unknown>),
    localeBasePath: ctx.localeBasePath ?? '',
  }),
}

/**
 * The second deployment override: the locale selector (ADR-0015).
 *
 * The library default entry renders nothing (it has no locale list). This
 * entry supplies the deployment's locales from `lib/locales` via
 * `LocaleSelectorConfigured`, so the selector shows in the header/footer
 * whenever more than one locale is configured — and stays hidden otherwise.
 */
const localeSelectorEntry: AnyComponentRegistryEntry = {
  component: LocaleSelectorConfigured,
}

const registryMap = new Map(defaultRegistry)
registryMap.set(HIERARCHY_MENU_SCHEMA, hierarchyMenuServerEntry)
registryMap.set(LOCALE_SELECTOR_SCHEMA, localeSelectorEntry)

export const registry: Registry = registryMap
