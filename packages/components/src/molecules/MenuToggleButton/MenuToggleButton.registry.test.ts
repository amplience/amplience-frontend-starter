// Tests for the menu-toggle-button registry entry — a leaf entry whose only
// adapter work is stripping the content envelope (ADR-0010 §4).

import { describe, expect, it } from 'vitest'

import {
  menuToggleButtonRegistryEntry,
  validateMenuToggleButtonSchema,
  type MenuToggleButtonSchema,
} from './MenuToggleButton.registry'

const labelled: MenuToggleButtonSchema = { _meta: { name: 'toggle' }, label: 'Open menu' }
const bare: MenuToggleButtonSchema = { _meta: {} }

describe('menuToggleButtonRegistryEntry', () => {
  it('strips the envelope and passes label through', () => {
    expect(menuToggleButtonRegistryEntry.propsFromSchema?.(labelled, {})).toEqual({
      label: 'Open menu',
    })
  })

  it('passes no label when the body omits it (component defaults it)', () => {
    expect(menuToggleButtonRegistryEntry.propsFromSchema?.(bare, {})).toEqual({})
  })

  it('is a leaf entry — no getChildren', () => {
    expect(menuToggleButtonRegistryEntry.getChildren).toBeUndefined()
  })
})

describe('validateMenuToggleButtonSchema', () => {
  it('accepts a body with a string label', () => {
    expect(validateMenuToggleButtonSchema(labelled)).toBe(true)
  })

  it('accepts a body with no label', () => {
    expect(validateMenuToggleButtonSchema(bare)).toBe(true)
  })

  it('rejects a non-string label', () => {
    expect(validateMenuToggleButtonSchema({ _meta: {}, label: 42 })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(validateMenuToggleButtonSchema(null)).toBe(false)
    expect(validateMenuToggleButtonSchema('menu')).toBe(false)
  })
})
