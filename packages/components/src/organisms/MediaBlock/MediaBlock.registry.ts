import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { MediaBlock, type MediaBlockProps } from './MediaBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MEDIA_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/media'

/**
 * The media delivery body — MediaBlock props plus the content envelope.
 * `bare`, `loadPriority`, `localeBasePath` and `sizes` are excluded: they're
 * layout/position/geometry cues supplied by the render context, not
 * author-editable fields.
 */
export type MediaBlockSchema = Omit<
  MediaBlockProps,
  'bare' | 'loadPriority' | 'localeBasePath' | 'sizes'
> & {
  readonly _meta: unknown
}

/**
 * Registry entry for the media schema. The adapter strips the `_meta`
 * envelope and sets `bare` and `loadPriority` from the render context — a
 * media block nested in a layout container drops its own section wrapper, one
 * near the top of the page loads more urgently than one further down
 * (ADR-0021), and it inherits the parent's slot width (`slotSizes`) so the
 * image sizes its srcset to the column.
 */
export const mediaBlockRegistryEntry: ComponentRegistryEntry<MediaBlockSchema, MediaBlockProps> = {
  component: MediaBlock,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    bare: ctx.bare ?? false,
    loadPriority: ctx.loadPriority ?? 'lazy',
    localeBasePath: ctx.localeBasePath ?? '',
    ...(ctx.slotSizes !== undefined && { sizes: ctx.slotSizes }),
  }),
}
