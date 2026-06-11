// Tests for registry composition helpers (QL-36).
//
// Node environment on purpose — composition is pure data wiring, no DOM.

import { describe, expect, it } from 'vitest'

import {
  createRegistry,
  createRegistryWithout,
  defaultRegistry,
  GRID_BLOCK_SCHEMA,
  HERO_BLOCK_SCHEMA,
  heroBlockRegistryEntry,
  MEDIA_CARD_SCHEMA,
  PAGE_SCHEMA,
  pageRegistryEntry,
} from './registry'

describe('createRegistry', () => {
  it('composes heterogeneous entries into a registry', () => {
    const registry = createRegistry([
      [HERO_BLOCK_SCHEMA, heroBlockRegistryEntry],
      [PAGE_SCHEMA, pageRegistryEntry],
    ])
    expect(registry.size).toBe(2)
    expect(registry.get(HERO_BLOCK_SCHEMA)).toBe(heroBlockRegistryEntry)
    expect(registry.get(PAGE_SCHEMA)).toBe(pageRegistryEntry)
  })
})

describe('createRegistryWithout', () => {
  it('removes the excluded schemas and keeps the rest', () => {
    const registry = createRegistryWithout(defaultRegistry, [GRID_BLOCK_SCHEMA, MEDIA_CARD_SCHEMA])
    expect(registry.size).toBe(defaultRegistry.size - 2)
    expect(registry.has(GRID_BLOCK_SCHEMA)).toBe(false)
    expect(registry.has(MEDIA_CARD_SCHEMA)).toBe(false)
    expect(registry.has(HERO_BLOCK_SCHEMA)).toBe(true)
  })

  it('does not mutate the base registry', () => {
    const sizeBefore = defaultRegistry.size
    createRegistryWithout(defaultRegistry, [GRID_BLOCK_SCHEMA])
    expect(defaultRegistry.size).toBe(sizeBefore)
    expect(defaultRegistry.has(GRID_BLOCK_SCHEMA)).toBe(true)
  })

  it('throws on a schema URI that is not in the base registry (loud, not silent)', () => {
    expect(() =>
      createRegistryWithout(defaultRegistry, ['https://quadratic.amplience.com/v2/content/typo']),
    ).toThrowError(/typo.*is not in the base registry/s)
  })
})
