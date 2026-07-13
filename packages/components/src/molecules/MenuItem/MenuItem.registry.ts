import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { MenuItem, type MenuItemProps } from './MenuItem'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MENU_ITEM_SCHEMA = 'https://quadratic.amplience.com/v2/content/menu-item'

/**
 * The menu-item delivery body — MenuItem props plus the content envelope and
 * the nested `children` content-links the renderer recurses into. The
 * `children` ReactNode prop is excluded: it arrives from the renderer.
 */
export type MenuItemSchema = Omit<MenuItemProps, 'children' | 'localeBasePath'> & {
  readonly _meta: unknown
  readonly children?: readonly unknown[]
}

/**
 * Validator: a MenuItem must have a `label` string.
 */
export const validateMenuItemSchema = (schema: unknown): schema is MenuItemSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  return typeof (schema as { label?: unknown }).label === 'string'
}

/**
 * Registry entry for the menu-item schema. A container entry: `getChildren`
 * returns the `children` array (nested MenuItem content-links) so the
 * renderer recurses into sub-menu items and passes them in as `children`.
 *
 * Note: the schema field `children` (content-links) shadows the prop
 * `children` (ReactNode). `propsFromSchema` strips the schema's `children`
 * via the `children: _children` destructure so the renderer-supplied
 * ReactNode children arrive cleanly.
 */
export const menuItemRegistryEntry: ComponentRegistryEntry<MenuItemSchema, MenuItemProps> = {
  component: MenuItem,
  propsFromSchema: ({ _meta: _envelope, children: _children, ...props }, ctx) => ({
    ...props,
    localeBasePath: ctx.localeBasePath ?? '',
  }),
  validate: validateMenuItemSchema,
  getChildren: (schema) => schema.children ?? [],
  childContext: { bare: true },
}
