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
 * '@amplience/quadratic-components/registry'. The helpers exist because a
 * bare `new Map(...)` anchors its value type on the first entry and rejects
 * entries for other schemas.
 */

import { defaultRegistry } from '@amplience/quadratic-components/registry'
import type { Registry } from '@amplience/quadratic-types'

export const registry: Registry = defaultRegistry
