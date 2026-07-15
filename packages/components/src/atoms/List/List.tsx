import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './List.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListAs = 'ul' | 'ol'

/**
 * Named gap scale — mirrors Stack's scale so the two compose predictably.
 *   none → 0
 *   xs   → × 1   (4px)
 *   sm   → × 2   (8px)
 *   md   → × 4   (16px)
 *   lg   → × 6   (24px)
 *   xl   → × 10  (40px)
 */
export type ListGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * Controls the list marker (bullet / number / none).
 *   auto   — browser default: disc for ul, decimal for ol
 *   none   — no marker (useful when styling items as cards/tiles)
 */
export type ListMarker = 'auto' | 'none'

export type ListProps = {
  children: ReactNode
  className?: string
  /**
   * Underlying HTML element. Defaults to `"ul"` (unordered).
   * Use `"ol"` for ordered / step-based lists.
   */
  as?: ListAs
  /**
   * Space between list items. Defaults to `"none"`.
   */
  gap?: ListGap
  /**
   * Whether to show the browser-default list marker.
   * Defaults to `"auto"` (disc for ul, decimal for ol).
   * Set to `"none"` when composing items as cards or tiles.
   */
  marker?: ListMarker
} & Omit<ComponentPropsWithoutRef<'ul'>, 'className' | 'children'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A semantic list container (`<ul>` or `<ol>`) with consistent gap control.
 * Pair with `<ListItem>` for individual items.
 *
 * Usage:
 *   <List>…</List>                          — ul, no gap, default markers
 *   <List as="ol" gap="sm">…</List>         — ol with 8px gap
 *   <List marker="none" gap="md">…</List>   — marker-free, for card grids
 */
export function List({
  children,
  className,
  as: El = 'ul',
  gap = 'none',
  marker = 'auto',
  ...rest
}: ListProps) {
  return (
    <El
      className={clsx('List', styles.root, styles[El], className)}
      data-gap={gap}
      data-marker={marker}
      {...rest}
    >
      {children}
    </El>
  )
}
