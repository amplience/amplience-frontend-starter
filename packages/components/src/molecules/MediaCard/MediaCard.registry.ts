import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { MediaCard, type MediaCardProps } from './MediaCard'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MEDIA_CARD_SCHEMA = 'https://quadratic.amplience.com/v2/content/media-card'

/**
 * The media-card delivery body — MediaCard props plus the content envelope.
 * `localeBasePath`, `sizes` and `loadPriority` are excluded: all three are
 * renderer-injected from context (locale, parent column geometry, and position
 * relative to the fold), not author-set.
 */
export type MediaCardSchema = Omit<MediaCardProps, 'localeBasePath' | 'sizes' | 'loadPriority'> & {
  readonly _meta: unknown
}

/**
 * Registry entry for the media-card schema. The adapter strips the `_meta`
 * envelope, sets `localeBasePath` from the render context so the card's link
 * stays inside the active locale, forwards the parent's `slotSizes` (when
 * present) so the cover image sizes its srcset to the real slot, and passes on
 * `loadPriority` so a card grid leading the page doesn't lazy-load its own
 * covers (ADR-0021); the remaining fields are the component's props
 * one-for-one.
 */
export const mediaCardRegistryEntry: ComponentRegistryEntry<MediaCardSchema, MediaCardProps> = {
  component: MediaCard,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    localeBasePath: ctx.localeBasePath ?? '',
    loadPriority: ctx.loadPriority ?? 'lazy',
    ...(ctx.slotSizes !== undefined && { sizes: ctx.slotSizes }),
  }),
}
