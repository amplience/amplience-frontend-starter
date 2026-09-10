import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { IconButton, type IconButtonProps } from './IconButton'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const ICON_BUTTON_SCHEMA = 'https://quadratic.amplience.com/v2/content/icon-button'

/** The icon-button delivery body — IconButton props plus the content envelope. */
export type IconButtonSchema = IconButtonProps & { readonly _meta: unknown }

/**
 * Validator: an IconButton must have both `icon` and `label` fields.
 * Missing `label` would produce an inaccessible icon-only element.
 */
export const validateIconButtonSchema = (schema: unknown): schema is IconButtonSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  const s = schema as { icon?: unknown; label?: unknown }
  return typeof s.icon === 'string' && typeof s.label === 'string'
}

/** Registry entry for the icon-button schema. Not a container — no `getChildren`. */
export const iconButtonRegistryEntry: ComponentRegistryEntry<IconButtonSchema, IconButtonProps> = {
  component: IconButton,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    localeBasePath: ctx.localeBasePath ?? '',
  }),
  validate: validateIconButtonSchema,
}
