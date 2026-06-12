// Tests for the columns registry entry (QL-40) — container-entry surface
// (ADR-0010 §4): the envelope and items stay out of the props, and items
// come back as the children the renderer recurses into.

import { describe, expect, it } from 'vitest'

import { columnsBlockRegistryEntry, type ColumnsBlockSchema } from './ColumnsBlock.registry'

const withItems = {
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/columns' },
  items: [{ kind: 'child' }],
} as ColumnsBlockSchema

const withoutItems = {
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/columns' },
} as ColumnsBlockSchema

describe('columnsBlockRegistryEntry', () => {
  it('strips the envelope and items from the props', () => {
    expect(columnsBlockRegistryEntry.propsFromSchema?.(withItems, {})).toEqual({})
  })

  it('hands items back to the renderer as children', () => {
    expect(columnsBlockRegistryEntry.getChildren?.(withItems)).toEqual([{ kind: 'child' }])
  })

  it('treats a block with no items as empty', () => {
    expect(columnsBlockRegistryEntry.getChildren?.(withoutItems)).toEqual([])
  })

  it('renders children bare — nested blocks drop their section wrappers', () => {
    expect(columnsBlockRegistryEntry.childContext).toEqual({ bare: true })
  })
})
