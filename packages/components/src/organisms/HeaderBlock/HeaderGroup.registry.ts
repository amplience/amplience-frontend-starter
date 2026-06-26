import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { HeaderGroup, type HeaderGroupProps } from './HeaderGroup'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const HEADER_GROUP_SCHEMA = 'https://quadratic.amplience.com/v2/content/header-group'

/**
 * The header-group delivery body — just the content envelope and the nested
 * `items` the renderer recurses into. No display props of its own.
 */
export type HeaderGroupSchema = {
  readonly _meta: unknown
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for the header-group schema. A container entry: `getChildren`
 * hands `items` back to the renderer for recursive resolution (with `bare`
 * context so nested blocks drop their section wrappers).
 */
export const headerGroupRegistryEntry: ComponentRegistryEntry<HeaderGroupSchema, HeaderGroupProps> =
  {
    component: HeaderGroup,
    propsFromSchema: ({ _meta: _envelope, items: _items }) => ({}),
    getChildren: (schema) => schema.items ?? [],
    childContext: { bare: true },
  }
