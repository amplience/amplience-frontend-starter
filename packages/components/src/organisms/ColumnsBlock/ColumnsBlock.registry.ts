import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { ColumnsBlock, type ColumnsBlockProps } from './ColumnsBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const COLUMNS_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/columns'

/**
 * The columns delivery body — ColumnsBlock's own props plus the content
 * envelope and the nested `items` the renderer recurses into. `children`
 * is excluded: it arrives from the renderer, not from content.
 */
export type ColumnsBlockSchema = Omit<ColumnsBlockProps, 'children'> & {
  readonly _meta: unknown
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for the columns schema. A container entry: `getChildren`
 * hands `items` back to the renderer, which renders them recursively (with
 * `bare` context, so nested blocks drop their section wrappers) and passes
 * the result in as `children`.
 */
export const columnsBlockRegistryEntry: ComponentRegistryEntry<
  ColumnsBlockSchema,
  ColumnsBlockProps
> = {
  component: ColumnsBlock,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
}
