import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { FooterRow, type FooterRowProps } from './FooterRow'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const FOOTER_ROW_SCHEMA = 'https://quadratic.amplience.com/v2/content/footer-row'

/**
 * The footer-row delivery body — FooterRow props plus the content envelope
 * and the nested `items` the renderer recurses into. `children` is excluded:
 * it arrives from the renderer, not from content.
 */
export type FooterRowSchema = Omit<FooterRowProps, 'children'> & {
  readonly _meta: unknown
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for the footer-row schema. A container entry: `getChildren`
 * hands `items` back to the renderer, which renders them recursively (with
 * `bare` context, so nested blocks drop their section wrappers) and passes
 * the result in as `children`.
 */
export const footerRowRegistryEntry: ComponentRegistryEntry<FooterRowSchema, FooterRowProps> = {
  component: FooterRow,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
}
