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

import type {
  AnyComponentRegistryEntry,
  Registry,
  SchemaURI,
} from '@amplience/frontend-starter-types'

import {
  ICON_BUTTON_SCHEMA,
  iconButtonRegistryEntry,
} from './molecules/IconButton/IconButton.registry'
import {
  LOCALE_SELECTOR_SCHEMA,
  localeSelectorRegistryEntry,
} from './molecules/LocaleSelector/LocaleSelector.registry'
import { LOGO_SCHEMA, logoRegistryEntry } from './molecules/Logo/Logo.registry'
import { MEDIA_CARD_SCHEMA, mediaCardRegistryEntry } from './molecules/MediaCard/MediaCard.registry'
import {
  HIERARCHY_MENU_ITEM_SCHEMA,
  hierarchyMenuItemRegistryEntry,
} from './molecules/MenuItem/HierarchyMenuItem.registry'
import { MENU_ITEM_SCHEMA, menuItemRegistryEntry } from './molecules/MenuItem/MenuItem.registry'
import {
  MENU_TOGGLE_BUTTON_SCHEMA,
  menuToggleButtonRegistryEntry,
} from './molecules/MenuToggleButton/MenuToggleButton.registry'
import {
  CAROUSEL_BLOCK_SCHEMA,
  carouselBlockRegistryEntry,
} from './organisms/CarouselBlock/CarouselBlock.registry'
import {
  COLUMNS_BLOCK_SCHEMA,
  columnsBlockRegistryEntry,
} from './organisms/ColumnsBlock/ColumnsBlock.registry'
import {
  FOOTER_BLOCK_SCHEMA,
  footerBlockRegistryEntry,
} from './organisms/FooterBlock/FooterBlock.registry'
import {
  FOOTER_ROW_SCHEMA,
  footerRowRegistryEntry,
} from './organisms/FooterBlock/FooterRow.registry'
import { GRID_BLOCK_SCHEMA, gridBlockRegistryEntry } from './organisms/GridBlock/GridBlock.registry'
import {
  HEADER_BLOCK_SCHEMA,
  headerBlockRegistryEntry,
} from './organisms/HeaderBlock/HeaderBlock.registry'
import {
  HEADER_GROUP_SCHEMA,
  headerGroupRegistryEntry,
} from './organisms/HeaderBlock/HeaderGroup.registry'
import {
  HEADER_ROW_SCHEMA,
  headerRowRegistryEntry,
} from './organisms/HeaderBlock/HeaderRow.registry'
import { HERO_BLOCK_SCHEMA, heroBlockRegistryEntry } from './organisms/HeroBlock/HeroBlock.registry'
import {
  MARKDOWN_BLOCK_SCHEMA,
  markdownBlockRegistryEntry,
} from './organisms/MarkdownBlock/MarkdownBlock.registry'
import {
  MEDIA_BLOCK_SCHEMA,
  mediaBlockRegistryEntry,
} from './organisms/MediaBlock/MediaBlock.registry'
import {
  HIERARCHY_MENU_SCHEMA,
  hierarchyMenuRegistryEntry,
} from './organisms/Menu/HierarchyMenu.registry'
import { MENU_SCHEMA, menuRegistryEntry } from './organisms/Menu/Menu.registry'
import { SLOT_SCHEMA, slotRegistryEntry } from './organisms/Slot/Slot.registry'
import {
  BLOG_ARTICLE_SCHEMA,
  blogArticleMetadataFromSchema,
  blogArticleRegistryEntry,
} from './templates/BlogArticle/BlogArticle.registry'
import type { BlogArticleSchema } from './templates/BlogArticle/BlogArticle.registry'
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
  [BLOG_ARTICLE_SCHEMA, blogArticleRegistryEntry],
  [SLOT_SCHEMA, slotRegistryEntry],
  [HERO_BLOCK_SCHEMA, heroBlockRegistryEntry],
  [MEDIA_BLOCK_SCHEMA, mediaBlockRegistryEntry],
  [MARKDOWN_BLOCK_SCHEMA, markdownBlockRegistryEntry],
  [COLUMNS_BLOCK_SCHEMA, columnsBlockRegistryEntry],
  [GRID_BLOCK_SCHEMA, gridBlockRegistryEntry],
  [CAROUSEL_BLOCK_SCHEMA, carouselBlockRegistryEntry],
  [MEDIA_CARD_SCHEMA, mediaCardRegistryEntry],
  [HEADER_BLOCK_SCHEMA, headerBlockRegistryEntry],
  [HEADER_ROW_SCHEMA, headerRowRegistryEntry],
  [HEADER_GROUP_SCHEMA, headerGroupRegistryEntry],
  [LOGO_SCHEMA, logoRegistryEntry],
  [ICON_BUTTON_SCHEMA, iconButtonRegistryEntry],
  [MENU_TOGGLE_BUTTON_SCHEMA, menuToggleButtonRegistryEntry],
  [LOCALE_SELECTOR_SCHEMA, localeSelectorRegistryEntry],
  [MENU_SCHEMA, menuRegistryEntry],
  [MENU_ITEM_SCHEMA, menuItemRegistryEntry],
  [HIERARCHY_MENU_SCHEMA, hierarchyMenuRegistryEntry],
  [HIERARCHY_MENU_ITEM_SCHEMA, hierarchyMenuItemRegistryEntry],
  [FOOTER_BLOCK_SCHEMA, footerBlockRegistryEntry],
  [FOOTER_ROW_SCHEMA, footerRowRegistryEntry],
])

// Re-export the schema URIs and entries so deployments composing bespoke
// registries import everything from one place.
export {
  CAROUSEL_BLOCK_SCHEMA,
  carouselBlockRegistryEntry,
  COLUMNS_BLOCK_SCHEMA,
  columnsBlockRegistryEntry,
  GRID_BLOCK_SCHEMA,
  gridBlockRegistryEntry,
  HERO_BLOCK_SCHEMA,
  heroBlockRegistryEntry,
  MEDIA_BLOCK_SCHEMA,
  mediaBlockRegistryEntry,
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
export {
  HEADER_BLOCK_SCHEMA,
  headerBlockRegistryEntry,
  HEADER_ROW_SCHEMA,
  headerRowRegistryEntry,
  HEADER_GROUP_SCHEMA,
  headerGroupRegistryEntry,
  LOGO_SCHEMA,
  logoRegistryEntry,
  ICON_BUTTON_SCHEMA,
  iconButtonRegistryEntry,
  MENU_TOGGLE_BUTTON_SCHEMA,
  menuToggleButtonRegistryEntry,
  LOCALE_SELECTOR_SCHEMA,
  localeSelectorRegistryEntry,
  MENU_SCHEMA,
  menuRegistryEntry,
  MENU_ITEM_SCHEMA,
  menuItemRegistryEntry,
  HIERARCHY_MENU_SCHEMA,
  hierarchyMenuRegistryEntry,
  HIERARCHY_MENU_ITEM_SCHEMA,
  hierarchyMenuItemRegistryEntry,
}
export { FOOTER_BLOCK_SCHEMA, footerBlockRegistryEntry, FOOTER_ROW_SCHEMA, footerRowRegistryEntry }
export { BLOG_ARTICLE_SCHEMA, blogArticleRegistryEntry, blogArticleMetadataFromSchema }
export type { BlogArticleSchema }
