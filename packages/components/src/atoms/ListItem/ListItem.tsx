import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './ListItem.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListItemProps = {
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<'li'>, 'className' | 'children'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A semantic list item (`<li>`) for use inside a `<List>`.
 * Accepts arbitrary children — text, links, or composed content.
 *
 * Usage:
 *   <List>
 *     <ListItem>First</ListItem>
 *     <ListItem>Second</ListItem>
 *   </List>
 */
export function ListItem({ children, className, ...rest }: ListItemProps) {
  return (
    <li className={clsx('ListItem', styles.root, className)} {...rest}>
      {children}
    </li>
  )
}
