import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotProps = {
  /** The slot's rendered components, in content order. */
  children?: ReactNode
  /**
   * Optional slot name (from `_meta.name`), exposed as a `data-slot`
   * attribute for debugging and styling hooks. No visual effect by default.
   */
  name?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Slot organism — the rendered form of an Amplience slot.
 *
 * A slot is an ordered list of components; this organism renders them in
 * content order inside a single `<div data-slot>` wrapper. The wrapper is
 * display: contents, so it is invisible to layout — blocks inside a slot
 * flow exactly as they would as direct children of the page — while still
 * giving the DOM a queryable slot boundary.
 *
 * The slot's children arrive already rendered (as ReactNode) — recursion
 * into the content tree is the renderer's job, not this component's.
 *
 * Usage (via the renderer):
 *   <Slot name="home/main">{renderedComponents}</Slot>
 */
export function Slot({ children, name }: SlotProps) {
  return (
    <div data-slot={name ?? true} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
