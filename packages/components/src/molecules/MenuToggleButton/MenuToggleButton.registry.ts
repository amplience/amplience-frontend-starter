import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { MenuToggleButton, type MenuToggleButtonProps } from './MenuToggleButton'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MENU_TOGGLE_BUTTON_SCHEMA =
  'https://quadratic.amplience.com/v2/content/menu-toggle-button'

/** The menu-toggle-button delivery body — props plus the content envelope. */
export type MenuToggleButtonSchema = MenuToggleButtonProps & { readonly _meta: unknown }

/**
 * Validator: everything is optional (the component defaults `label`), so the
 * only invalid shape is a `label` that exists but isn't a string.
 */
export const validateMenuToggleButtonSchema = (
  schema: unknown,
): schema is MenuToggleButtonSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  const s = schema as { label?: unknown }
  return s.label === undefined || typeof s.label === 'string'
}

/** Registry entry for the menu-toggle-button schema. Not a container — no `getChildren`. */
export const menuToggleButtonRegistryEntry: ComponentRegistryEntry<
  MenuToggleButtonSchema,
  MenuToggleButtonProps
> = {
  component: MenuToggleButton,
  propsFromSchema: ({ _meta: _envelope, ...props }) => props,
  validate: validateMenuToggleButtonSchema,
}
