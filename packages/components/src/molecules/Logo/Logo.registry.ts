import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { Logo, type LogoProps } from './Logo'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const LOGO_SCHEMA = 'https://quadratic.amplience.com/v2/content/logo'

/** The logo delivery body — Logo props plus the content envelope. */
export type LogoSchema = Omit<LogoProps, 'localeBasePath'> & { readonly _meta: unknown }

/**
 * Validator: a Logo must have a media object with a mediaType discriminator
 * and the minimum its branch needs to render — ManualImage a `src`,
 * DynamicImage an image-link. Fails loudly at the dispatch boundary rather
 * than rendering a broken image.
 */
export const validateLogoSchema = (schema: unknown): schema is LogoSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  const media = (schema as { image?: unknown }).image
  if (typeof media !== 'object' || media === null) return false
  const { mediaType, image } = media as { mediaType?: unknown; image?: unknown }
  if (typeof image !== 'object' || image === null) return false
  if (mediaType === 'ManualImage') return 'src' in image
  if (mediaType === 'DynamicImage') {
    const link = (image as { image?: unknown }).image
    return typeof link === 'object' && link !== null && 'name' in link
  }
  return false
}

/** Registry entry for the logo schema. Not a container — no `getChildren`. */
export const logoRegistryEntry: ComponentRegistryEntry<LogoSchema, LogoProps> = {
  component: Logo,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    localeBasePath: ctx.localeBasePath ?? '',
  }),
  validate: validateLogoSchema,
}
