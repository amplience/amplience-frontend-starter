// Tests for the grid registry entry (QL-40) — container-entry surface
// (ADR-0010 §4): the envelope and items stay out of the props, and items
// come back as the children the renderer recurses into.

import { describe, expect, it } from 'vitest'

import { gridBlockRegistryEntry, type GridBlockSchema } from './GridBlock.registry'

const withItems = {
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/grid' },
  items: [{ kind: 'child' }],
} as GridBlockSchema

const withoutItems = {
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/grid' },
} as GridBlockSchema

describe('gridBlockRegistryEntry', () => {
  it('strips the envelope and items from the props', () => {
    expect(gridBlockRegistryEntry.propsFromSchema?.(withItems, {})).toEqual({})
  })

  it('hands items back to the renderer as children', () => {
    expect(gridBlockRegistryEntry.getChildren?.(withItems)).toEqual([{ kind: 'child' }])
  })

  it('treats a block with no items as empty', () => {
    expect(gridBlockRegistryEntry.getChildren?.(withoutItems)).toEqual([])
  })

  it('renders children bare — nested blocks drop their section wrappers', () => {
    expect(gridBlockRegistryEntry.childContext).toEqual({ bare: true })
  })
})
