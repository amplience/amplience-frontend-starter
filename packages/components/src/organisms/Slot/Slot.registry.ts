import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { Slot, type SlotProps } from './Slot'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const SLOT_SCHEMA = 'https://quadratic.amplience.com/v2/slots/slot'

/** The slot delivery body — an ordered list of component content nodes. */
export type SlotSchema = {
  readonly _meta: { readonly name?: string }
  readonly components?: readonly unknown[]
}

/**
 * Registry entry for the slot schema. A container entry: `getChildren` hands
 * the slot's `components` back to the renderer, which renders them
 * recursively and passes the result in as `children`.
 */
export const slotRegistryEntry: ComponentRegistryEntry<SlotSchema, SlotProps> = {
  component: Slot,
  propsFromSchema: (schema) => {
    const props: SlotProps = {}
    if (schema._meta.name != null) return { ...props, name: schema._meta.name }
    return props
  },
  getChildren: (schema) => schema.components ?? [],
}
