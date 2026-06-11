import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { MarkdownBlock, type MarkdownBlockProps } from './MarkdownBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const MARKDOWN_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/markdown-block'

/**
 * The markdown-block delivery body — MarkdownBlock props plus the content
 * envelope. `bare` is excluded: it's a layout cue supplied by the render
 * context, not an author-editable field.
 */
export type MarkdownBlockSchema = Omit<MarkdownBlockProps, 'bare'> & { readonly _meta: unknown }

/**
 * Registry entry for the markdown-block schema. The adapter strips the
 * `_meta` envelope and sets `bare` from the render context so a block nested
 * in a layout container drops its own section wrapper.
 */
export const markdownBlockRegistryEntry: ComponentRegistryEntry<
  MarkdownBlockSchema,
  MarkdownBlockProps
> = {
  component: MarkdownBlock,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    bare: ctx.bare ?? false,
  }),
}
