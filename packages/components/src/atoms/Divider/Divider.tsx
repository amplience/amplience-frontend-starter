import clsx from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

import styles from './Divider.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DividerOrientation = 'horizontal' | 'vertical'

export type DividerProps = {
  className?: string
  /**
   * `horizontal` (default) — a full-width rule between block-level content.
   * `vertical`             — a 1px tall rule for use inside flex/grid rows.
   *                          The parent must give it an explicit height, or
   *                          set `align-items: stretch`.
   */
  orientation?: DividerOrientation
} & Omit<ComponentPropsWithoutRef<'hr'>, 'className'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A thin visual separator. Renders as a native `<hr>` so it carries correct
 * ARIA semantics (`role="separator"`) out of the box.
 *
 * Usage:
 *   <Divider />
 *   <Divider orientation="vertical" />
 *   <Divider className="my-custom-class" />
 */
export function Divider({ className, orientation = 'horizontal', ...rest }: DividerProps) {
  return (
    <hr
      className={clsx('Divider', styles.root, className)}
      data-orientation={orientation}
      aria-orientation={orientation}
      {...rest}
    />
  )
}
