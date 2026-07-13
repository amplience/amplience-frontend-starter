import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { MenuItem, type MenuItemProps } from './MenuItem'

/**
 * Schema URI for the HierarchyMenuItem content type.
 */
export const HIERARCHY_MENU_ITEM_SCHEMA =
  'https://quadratic.amplience.com/v2/content/hierarchy-menu-item'

/**
 * The HierarchyMenuItem delivery body after hierarchy assembly.
 * `children` is populated by `ContentClient.getHierarchy()` — it is not a
 * field in the schema itself (child relationships are managed by DC's hierarchy
 * system).
 */
export type HierarchyMenuItemSchema = Omit<MenuItemProps, 'children' | 'localeBasePath'> & {
  readonly _meta: unknown
  /** Injected by getHierarchy() — not a schema field. */
  readonly children?: readonly unknown[]
}

/**
 * Validator: a HierarchyMenuItem must have a `label` string.
 */
export const validateHierarchyMenuItemSchema = (
  schema: unknown,
): schema is HierarchyMenuItemSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  return typeof (schema as { label?: unknown }).label === 'string'
}

/**
 * Registry entry for HierarchyMenuItem. Structurally identical to
 * menuItemRegistryEntry; the schema URI is the only difference for dispatch.
 */
export const hierarchyMenuItemRegistryEntry: ComponentRegistryEntry<
  HierarchyMenuItemSchema,
  MenuItemProps
> = {
  component: MenuItem,
  propsFromSchema: ({ _meta: _envelope, children: _children, ...props }, ctx) => ({
    ...props,
    localeBasePath: ctx.localeBasePath ?? '',
  }),
  validate: validateHierarchyMenuItemSchema,
  getChildren: (schema) => schema.children ?? [],
  childContext: { bare: true },
}
