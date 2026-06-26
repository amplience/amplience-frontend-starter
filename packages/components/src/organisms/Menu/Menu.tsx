import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './Menu.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MenuProps = {
  /**
   * When true, applies `data-mobile-layout` which CSS uses to hide the item
   * list and show a hamburger toggle on small viewports. The toggle itself
   * is a brand/application concern — add a button and toggle `data-open` on
   * the nav element via JavaScript.
   */
  useMobileLayout?: boolean
  children?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Menu organism — the site navigation menu.
 *
 * Renders a `<nav>` with a `<ul>` containing MenuItem children. The menu
 * grows to fill available horizontal space (flex: 1) so it can sit alongside
 * icon buttons in a HeaderRow and push them to the edge.
 *
 * Mobile layout:
 *   When `useMobileLayout` is true the list is hidden on small screens via
 *   CSS. Brands add a hamburger button and toggle `data-open` on the <nav>
 *   to reveal the drawer — no JS is shipped by this component.
 *
 * Semantic:
 *   `aria-label="Site navigation"` distinguishes this nav from any other
 *   navigation landmarks on the page (e.g. breadcrumbs, footer nav).
 */
export function Menu({ useMobileLayout = false, children, className }: MenuProps) {
  return (
    <nav
      className={clsx(styles.root, className)}
      data-mobile-layout={useMobileLayout || undefined}
      aria-label="Site navigation"
    >
      <ul className={styles.list}>{children}</ul>
    </nav>
  )
}
