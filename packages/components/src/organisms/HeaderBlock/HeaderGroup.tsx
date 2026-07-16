import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './HeaderGroup.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeaderGroupProps = {
  children?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HeaderGroup — a thin flex wrapper that keeps its children visually together
 * within a `justify-content: space-between` header row.
 *
 * A HeaderRow spreads its direct children across the full width; wrapping two
 * or more items in a HeaderGroup keeps them adjacent as a single unit. No
 * configuration needed — layout is the sole purpose.
 *
 * Items (Logo, IconButton, Menu) are passed in as `children` by the renderer.
 */
export function HeaderGroup({ children, className }: HeaderGroupProps) {
  return <div className={clsx('HeaderGroup', styles.root, className)}>{children}</div>
}
