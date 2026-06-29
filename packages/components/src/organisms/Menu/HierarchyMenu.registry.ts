import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { Menu, type MenuProps } from './Menu'

/**
 * Schema URI for the HierarchyMenu content type.
 *
 * HierarchyMenu uses Amplience's hierarchy trait: editors see a native DC tree
 * UI for authoring nested nav items. The delivery shape — after `getHierarchy`
 * assembles children inline — is identical to the array-based Menu, so both
 * content types render using the same `<Menu>` and `<MenuItem>` components.
 */
export const HIERARCHY_MENU_SCHEMA = 'https://quadratic.amplience.com/v2/content/hierarchy-menu'

/**
 * The HierarchyMenu delivery body after hierarchy assembly.
 * `items` is populated by `ContentClient.getHierarchy()` rather than stored
 * inline in the content item — there is no `items` field in the schema itself.
 */
export type HierarchyMenuSchema = Omit<MenuProps, 'children'> & {
  readonly _meta: unknown
  /** Injected by getHierarchy() — not a schema field. */
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for HierarchyMenu. Structurally identical to menuRegistryEntry;
 * the schema URI is the only difference that matters for dispatch.
 */
export const hierarchyMenuRegistryEntry: ComponentRegistryEntry<HierarchyMenuSchema, MenuProps> = {
  component: Menu,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
}
