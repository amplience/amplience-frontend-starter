import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { Logo, type LogoProps } from './Logo'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const LOGO_SCHEMA = 'https://quadratic.amplience.com/v2/content/logo'

/** The logo delivery body — Logo props plus the content envelope. */
export type LogoSchema = LogoProps & { readonly _meta: unknown }

/**
 * Validator: a Logo must have an image object with at least a `src` field.
 * Fails loudly at the dispatch boundary rather than rendering a broken image.
 */
export const validateLogoSchema = (schema: unknown): schema is LogoSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  const image = (schema as { image?: unknown }).image
  return typeof image === 'object' && image !== null && 'src' in image
}

/** Registry entry for the logo schema. Not a container — no `getChildren`. */
export const logoRegistryEntry: ComponentRegistryEntry<LogoSchema, LogoProps> = {
  component: Logo,
  propsFromSchema: ({ _meta: _envelope, ...props }) => props,
  validate: validateLogoSchema,
}
