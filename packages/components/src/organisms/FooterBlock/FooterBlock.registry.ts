import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { FooterBlock, type FooterBlockProps } from './FooterBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const FOOTER_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/footer'

/**
 * The footer delivery body — FooterBlock props plus the content envelope
 * and the nested `rows` the renderer recurses into. `children` is excluded:
 * it arrives from the renderer, not from content.
 */
export type FooterBlockSchema = Omit<FooterBlockProps, 'children'> & {
  readonly _meta: unknown
  readonly rows?: readonly unknown[]
}

/**
 * Registry entry for the footer schema. A container entry: `getChildren`
 * hands `rows` back to the renderer, which renders them recursively and
 * passes the result in as `children`.
 */
export const footerBlockRegistryEntry: ComponentRegistryEntry<FooterBlockSchema, FooterBlockProps> =
  {
    component: FooterBlock,
    propsFromSchema: ({ _meta: _envelope, rows: _rows, ...props }) => props,
    getChildren: (schema) => schema.rows ?? [],
  }
