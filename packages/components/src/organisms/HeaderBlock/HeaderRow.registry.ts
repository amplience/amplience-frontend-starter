import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { HeaderRow, type HeaderRowProps } from './HeaderRow'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const HEADER_ROW_SCHEMA = 'https://quadratic.amplience.com/v2/content/header-row'

/**
 * The header-row delivery body — HeaderRow props plus the content envelope
 * and the nested `items` the renderer recurses into. `children` is excluded:
 * it arrives from the renderer, not from content.
 */
export type HeaderRowSchema = Omit<HeaderRowProps, 'children'> & {
  readonly _meta: unknown
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for the header-row schema. A container entry: `getChildren`
 * hands `items` back to the renderer, which renders them recursively (with
 * `bare` context, so nested blocks drop their section wrappers) and passes
 * the result in as `children`.
 */
export const headerRowRegistryEntry: ComponentRegistryEntry<HeaderRowSchema, HeaderRowProps> = {
  component: HeaderRow,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
}
