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

  it('derives the cell slot width from the default column counts', () => {
    expect(gridBlockRegistryEntry.childContextFromSchema?.(withoutItems, {})).toEqual({
      slotSizes: '(min-width: 992px) 33.34vw, (min-width: 769px) 50vw, 100vw',
    })
  })

  it('derives the cell slot width from explicit fixed column counts', () => {
    const fourUp = {
      _meta: { schema: 'https://quadratic.amplience.com/v2/content/grid' },
      columnsMobile: 2,
      columnsTablet: 3,
      columnsDesktop: 4,
    } as GridBlockSchema
    expect(gridBlockRegistryEntry.childContextFromSchema?.(fourUp, {})).toEqual({
      slotSizes: '(min-width: 992px) 25vw, (min-width: 769px) 33.34vw, 50vw',
    })
  })

  it('derives an auto-mode slot width from the min item width', () => {
    const auto = {
      _meta: { schema: 'https://quadratic.amplience.com/v2/content/grid' },
      sizingMode: 'auto',
      minItemWidth: 300,
    } as GridBlockSchema
    expect(gridBlockRegistryEntry.childContextFromSchema?.(auto, {})).toEqual({
      slotSizes: '(min-width: 600px) 600px, 100vw',
    })
  })
})
