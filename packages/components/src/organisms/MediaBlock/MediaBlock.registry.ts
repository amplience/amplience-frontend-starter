import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { MediaBlock, type MediaBlockProps } from './MediaBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MEDIA_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/media'

/**
 * The media delivery body — MediaBlock props plus the content envelope.
 * `bare` and `isTopOfPage` are excluded: they're layout/position cues
 * supplied by the render context, not author-editable fields.
 */
export type MediaBlockSchema = Omit<MediaBlockProps, 'bare' | 'isTopOfPage' | 'localeBasePath'> & {
  readonly _meta: unknown
}

/**
 * Registry entry for the media schema. The adapter strips the `_meta`
 * envelope and sets `bare` and `isTopOfPage` from the render context — a
 * media block nested in a layout container drops its own section wrapper,
 * and one leading the page loads eagerly.
 */
export const mediaBlockRegistryEntry: ComponentRegistryEntry<MediaBlockSchema, MediaBlockProps> = {
  component: MediaBlock,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    bare: ctx.bare ?? false,
    isTopOfPage: ctx.isTopOfPage ?? false,
    localeBasePath: ctx.localeBasePath ?? '',
  }),
}
