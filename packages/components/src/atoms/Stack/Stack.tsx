import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './Stack.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StackDirection = 'row' | 'column'

/**
 * Named gap scale. Values are multiples of `--spacing` (4px default):
 *   none → 0
 *   xs   → × 1   (4px)
 *   sm   → × 2   (8px)
 *   md   → × 4   (16px) — same as `--gap`
 *   lg   → × 6   (24px)
 *   xl   → × 10  (40px) — same as `--site-gutter`
 */
export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type StackProps = {
  children: ReactNode
  className?: string
  /**
   * Flex direction. Defaults to `"column"` (the most common case:
   * stacking blocks of content vertically).
   */
  direction?: StackDirection
  /**
   * Space between children. Mapped to a token-derived gap value.
   * Defaults to `"md"` (16px at the base spacing unit).
   */
  gap?: StackGap
} & Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A flex container that distributes children along a single axis with
 * consistent spacing. Eliminates the recurring
 * `display:flex; flex-direction:…; gap:…` boilerplate.
 *
 * Usage:
 *   <Stack>…</Stack>                          — column, md gap
 *   <Stack direction="row" gap="sm">…</Stack> — row, 8px gap
 *   <Stack gap="xl">…</Stack>                 — column, gutter-sized gap
 */
export function Stack({
  children,
  className,
  direction = 'column',
  gap = 'md',
  ...rest
}: StackProps) {
  return (
    <div
      className={clsx(styles.root, className)}
      data-direction={direction}
      data-gap={gap}
      {...rest}
    >
      {children}
    </div>
  )
}
