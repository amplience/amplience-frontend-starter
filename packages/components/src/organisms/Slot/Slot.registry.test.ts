// Tests for the slot registry entry (QL-40) — the container-entry surface
// the renderer recurses through (ADR-0010 §4).

import { describe, expect, it } from 'vitest'

import { slotRegistryEntry, type SlotSchema } from './Slot.registry'

const named: SlotSchema = { _meta: { name: 'homepage-hero' }, components: [{ kind: 'child' }] }
const anonymous: SlotSchema = { _meta: {} }

describe('slotRegistryEntry', () => {
  it('maps _meta.name to the name prop when the slot is named', () => {
    expect(slotRegistryEntry.propsFromSchema?.(named, {})).toEqual({ name: 'homepage-hero' })
  })

  it('passes no name prop when the slot is anonymous', () => {
    expect(slotRegistryEntry.propsFromSchema?.(anonymous, {})).toEqual({})
  })

  it('hands components back to the renderer as children', () => {
    expect(slotRegistryEntry.getChildren?.(named)).toEqual([{ kind: 'child' }])
  })

  it('treats a slot with no components as empty', () => {
    expect(slotRegistryEntry.getChildren?.(anonymous)).toEqual([])
  })
})
