import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { HeaderBlock, type HeaderBlockProps } from './HeaderBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const HEADER_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/header'

/**
 * The header delivery body — HeaderBlock props plus the content envelope
 * and the nested `rows` the renderer recurses into. `children` is excluded:
 * it arrives from the renderer, not from content.
 */
export type HeaderBlockSchema = Omit<HeaderBlockProps, 'children'> & {
  readonly _meta: unknown
  readonly rows?: readonly unknown[]
}

/**
 * Registry entry for the header schema. A container entry: `getChildren`
 * hands `rows` back to the renderer, which renders them recursively and
 * passes the result in as `children`.
 */
export const headerBlockRegistryEntry: ComponentRegistryEntry<HeaderBlockSchema, HeaderBlockProps> =
  {
    component: HeaderBlock,
    propsFromSchema: ({ _meta: _envelope, rows: _rows, ...props }) => props,
    getChildren: (schema) => schema.rows ?? [],
  }
