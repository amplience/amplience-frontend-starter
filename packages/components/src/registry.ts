/**
 * defaultRegistry — every component's registry entry, composed (ADR-0010 §5),
 * plus the helpers a deployment composes its own registry with.
 *
 * Three composition routes, in increasing order of selectivity:
 *
 * 1. Everything — the library default, as-is:
 *
 *      const registry = defaultRegistry
 *
 * 2. Only what you pick — compose from entries à la carte:
 *
 *      const registry = createRegistry([
 *        [HERO_BLOCK_SCHEMA, heroBlockRegistryEntry],
 *        [myCustomSchemaUri, myCustomEntry],
 *      ])
 *
 * 3. Everything apart from a few — subtract from a base registry:
 *
 *      const registry = createRegistryWithout(defaultRegistry, [
 *        GRID_BLOCK_SCHEMA,
 *        MEDIA_CARD_SCHEMA,
 *      ])
 *
 * The registry is a configuration object, not a framework: composition is
 * the deployment's act, and the library provides the building blocks plus
 * this sensible default. Components never register themselves (ADR-0010 §10).
 */

import type { AnyComponentRegistryEntry, Registry, SchemaURI } from '@amplience/quadratic-types'

import { MEDIA_CARD_SCHEMA, mediaCardRegistryEntry } from './molecules/MediaCard/MediaCard.registry'
import {
  COLUMNS_BLOCK_SCHEMA,
  columnsBlockRegistryEntry,
} from './organisms/ColumnsBlock/ColumnsBlock.registry'
import { GRID_BLOCK_SCHEMA, gridBlockRegistryEntry } from './organisms/GridBlock/GridBlock.registry'
import { HERO_BLOCK_SCHEMA, heroBlockRegistryEntry } from './organisms/HeroBlock/HeroBlock.registry'
import {
  IMAGE_BLOCK_SCHEMA,
  imageBlockRegistryEntry,
} from './organisms/ImageBlock/ImageBlock.registry'
import {
  MARKDOWN_BLOCK_SCHEMA,
  markdownBlockRegistryEntry,
} from './organisms/MarkdownBlock/MarkdownBlock.registry'
import { SLOT_SCHEMA, slotRegistryEntry } from './organisms/Slot/Slot.registry'
import {
  PAGE_SCHEMA,
  pageMetadataFromSchema,
  pageRegistryEntry,
} from './templates/Page/Page.registry'
import type {
  PageMetadata,
  PageMetadataOptions,
  PageRobots,
  PageSchema,
  PageSocialCard,
} from './templates/Page/Page.registry'

/**
 * Build a Registry from `[schemaURI, entry]` pairs.
 *
 * Typing sugar over `new Map(...)`: a bare Map constructor infers its value
 * type from the entries themselves — with entries for two different schemas
 * it anchors on the first and rejects the rest, since
 * `ComponentRegistryEntry<PageSchema, PageProps>` is not assignable to
 * `ComponentRegistryEntry<HeroBlockSchema, HeroBlockProps>`. This helper
 * pins the value type to the erased entry shape (ADR-0010 §2) so
 * heterogeneous compositions type-check, with each entry still fully typed
 * at its own definition site.
 */
export const createRegistry = (
  entries: readonly (readonly [SchemaURI, AnyComponentRegistryEntry])[],
): Registry => new Map(entries)

/**
 * Build a Registry containing everything in `base` apart from the given
 * schema URIs.
 *
 * Excluding a URI that isn't in `base` throws at composition time: a typo'd
 * exclusion that silently did nothing would be the same failure mode as
 * v1's silent override fallthrough, and registry composition runs at module
 * load — exactly where a registration-time bug should surface (ADR-0010).
 */
export const createRegistryWithout = (base: Registry, exclude: readonly SchemaURI[]): Registry => {
  const next = new Map(base)
  for (const uri of exclude) {
    if (!next.delete(uri)) {
      throw new Error(
        `createRegistryWithout: "${uri}" is not in the base registry. ` +
          `Base contains: ${[...base.keys()].join(', ')}`,
      )
    }
  }
  return next
}

export const defaultRegistry: Registry = createRegistry([
  [PAGE_SCHEMA, pageRegistryEntry],
  [SLOT_SCHEMA, slotRegistryEntry],
  [HERO_BLOCK_SCHEMA, heroBlockRegistryEntry],
  [IMAGE_BLOCK_SCHEMA, imageBlockRegistryEntry],
  [MARKDOWN_BLOCK_SCHEMA, markdownBlockRegistryEntry],
  [COLUMNS_BLOCK_SCHEMA, columnsBlockRegistryEntry],
  [GRID_BLOCK_SCHEMA, gridBlockRegistryEntry],
  [MEDIA_CARD_SCHEMA, mediaCardRegistryEntry],
])

// Re-export the schema URIs and entries so deployments composing bespoke
// registries import everything from one place.
export {
  COLUMNS_BLOCK_SCHEMA,
  columnsBlockRegistryEntry,
  GRID_BLOCK_SCHEMA,
  gridBlockRegistryEntry,
  HERO_BLOCK_SCHEMA,
  heroBlockRegistryEntry,
  IMAGE_BLOCK_SCHEMA,
  imageBlockRegistryEntry,
  MARKDOWN_BLOCK_SCHEMA,
  markdownBlockRegistryEntry,
  MEDIA_CARD_SCHEMA,
  mediaCardRegistryEntry,
  PAGE_SCHEMA,
  pageMetadataFromSchema,
  pageRegistryEntry,
  SLOT_SCHEMA,
  slotRegistryEntry,
}
export type { PageMetadata, PageMetadataOptions, PageRobots, PageSchema, PageSocialCard }
