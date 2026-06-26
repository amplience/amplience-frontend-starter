import clsx from 'clsx'
import { Children } from 'react'
import type { ReactNode } from 'react'

import styles from './MenuItem.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MenuItemProps = {
  /** Display text for this menu item. */
  label: string
  /**
   * URL this item navigates to. Omit for parent-only category labels that
   * expand a sub-menu but do not navigate on their own.
   */
  link?: string
  /**
   * Optional nested MenuItem children rendered as a sub-menu dropdown.
   * Provided by the renderer when the content item has `children` content-links.
   */
  children?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MenuItem molecule — a single navigation item, optionally with a dropdown.
 *
 * When `link` is provided the label renders as an `<a>` tag. Without `link`
 * it renders as a `<span>` — useful for category headings that expand a
 * sub-menu but don't navigate.
 *
 * Sub-menu:
 *   When `children` are present a `<ul>` dropdown is rendered. The dropdown
 *   reveals on :hover and :focus-within using pure CSS so it works without JS.
 *   Brands can replace the hover trigger with a click-open pattern by toggling
 *   `data-open` on the <li> via JavaScript.
 *
 * Rendering note:
 *   MenuItem is always rendered inside a Menu's <ul>, so it outputs a <li>
 *   as its root element, satisfying the ul > li content model. The renderer
 *   passes `bare: true` context so no additional wrapper is added.
 */
export function MenuItem({ label, link, children, className }: MenuItemProps) {
  const hasChildren = Children.count(children) > 0

  return (
    <li className={clsx(styles.root, className)} data-has-children={hasChildren || undefined}>
      {link ? (
        <a href={link} className={styles.link}>
          {label}
        </a>
      ) : (
        <span className={styles.label}>{label}</span>
      )}

      {hasChildren && <ul className={styles.submenu}>{children}</ul>}
    </li>
  )
}
