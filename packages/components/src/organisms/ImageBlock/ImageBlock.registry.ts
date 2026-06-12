import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { ImageBlock, type ImageBlockProps } from './ImageBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const IMAGE_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/image'

/**
 * The image delivery body — ImageBlock props plus the content envelope.
 * `bare` and `isTopOfPage` are excluded: they're layout/position cues
 * supplied by the render context, not author-editable fields.
 */
export type ImageBlockSchema = Omit<ImageBlockProps, 'bare' | 'isTopOfPage'> & {
  readonly _meta: unknown
}

/**
 * Registry entry for the image schema. The adapter strips the `_meta`
 * envelope and sets `bare` and `isTopOfPage` from the render context — an
 * image nested in a layout container drops its own section wrapper, and one
 * leading the page loads eagerly.
 */
export const imageBlockRegistryEntry: ComponentRegistryEntry<ImageBlockSchema, ImageBlockProps> = {
  component: ImageBlock,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    bare: ctx.bare ?? false,
    isTopOfPage: ctx.isTopOfPage ?? false,
  }),
}
