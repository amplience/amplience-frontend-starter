import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { gridBlockSlotSizes } from '../../utils/imageSizes'
import { GridBlock, type GridBlockProps } from './GridBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const GRID_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/grid'

/**
 * The grid delivery body — GridBlock's own props plus the content envelope
 * and the nested `items` the renderer recurses into. `children` is excluded:
 * it arrives from the renderer, not from content.
 */
export type GridBlockSchema = Omit<GridBlockProps, 'children'> & {
  readonly _meta: unknown
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for the grid schema. A container entry: `getChildren` hands
 * `items` back to the renderer, which renders them recursively (with `bare`
 * context, so nested blocks drop their section wrappers) and passes the
 * result in as `children`.
 */
export const gridBlockRegistryEntry: ComponentRegistryEntry<GridBlockSchema, GridBlockProps> = {
  component: GridBlock,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
  // Tell each cell how wide it renders (defaults mirror GridBlock's own) so
  // media inside it sizes its srcset to the column, not the viewport.
  childContextFromSchema: (schema) => ({
    slotSizes: gridBlockSlotSizes({
      sizingMode: schema.sizingMode ?? 'fixed',
      columnsMobile: schema.columnsMobile ?? 1,
      columnsTablet: schema.columnsTablet ?? 2,
      columnsDesktop: schema.columnsDesktop ?? 3,
      minItemWidth: schema.minItemWidth ?? 250,
    }),
  }),
}
