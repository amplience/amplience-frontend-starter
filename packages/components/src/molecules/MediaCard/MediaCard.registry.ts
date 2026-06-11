import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { MediaCard, type MediaCardProps } from './MediaCard'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MEDIA_CARD_SCHEMA = 'https://quadratic.amplience.com/v2/content/media-card'

/** The media-card delivery body — MediaCard props plus the content envelope. */
export type MediaCardSchema = MediaCardProps & { readonly _meta: unknown }

/**
 * Registry entry for the media-card schema. The adapter strips the `_meta`
 * envelope; the remaining fields are the component's props one-for-one.
 */
export const mediaCardRegistryEntry: ComponentRegistryEntry<MediaCardSchema, MediaCardProps> = {
  component: MediaCard,
  propsFromSchema: ({ _meta: _envelope, ...props }) => props,
}
