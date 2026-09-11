import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { Menu, type MenuProps } from './Menu'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MENU_SCHEMA = 'https://quadratic.amplience.com/v2/content/menu'

/**
 * The menu delivery body — Menu props plus the content envelope and the
 * nested `items` the renderer recurses into. `children` is excluded: it
 * arrives from the renderer, not from content.
 */
export type MenuSchema = Omit<MenuProps, 'children'> & {
  readonly _meta: unknown
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for the menu schema. A container entry: `getChildren`
 * hands `items` back to the renderer, which renders them recursively (with
 * `bare` context, so nested blocks drop their section wrappers) and passes
 * the result in as `children`.
 */
export const menuRegistryEntry: ComponentRegistryEntry<MenuSchema, MenuProps> = {
  component: Menu,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
}
