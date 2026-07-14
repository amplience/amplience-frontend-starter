import clsx from 'clsx'
import { Children } from 'react'
import type { ReactNode } from 'react'

import { Icon } from '../../atoms/Icon/Icon'
import type { IconName } from '../../atoms/Icon/Icon'
import { Link } from '../../atoms/Link/Link'
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
   * Optional icon from the design system's icon set, shown before the label.
   * Decorative — the label remains the accessible name.
   */
  icon?: IconName
  /**
   * Restrict this item to a single breakpoint (`mobileOnly` / `desktopOnly`).
   * Omit to show it at all breakpoints. Useful for nav entries that only make
   * sense on one form factor, e.g. a mobile-only cart or account shortcut.
   */
  visibility?: 'mobileOnly' | 'desktopOnly'
  /**
   * Optional nested MenuItem children rendered as a sub-menu dropdown.
   * Provided by the renderer when the content item has `children` content-links.
   */
  children?: ReactNode
  /**
   * Active locale URL prefix (ADR-0015), supplied by the renderer. Keeps nav
   * links inside the current locale. Defaults to '' (default locale).
   */
  localeBasePath?: string
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
export function MenuItem({
  label,
  link,
  icon,
  visibility,
  children,
  localeBasePath,
  className,
}: MenuItemProps) {
  const hasChildren = Children.count(children) > 0

  const content = (
    <>
      {icon && <Icon name={icon} size={18} />}
      {label}
    </>
  )

  return (
    <li
      className={clsx(styles.root, visibility && styles[visibility], className)}
      data-has-children={hasChildren || undefined}
    >
      {link ? (
        <Link
          href={link}
          className={styles.link ?? ''}
          {...(localeBasePath !== undefined && { localeBasePath })}
        >
          {content}
        </Link>
      ) : (
        <span className={styles.label}>{content}</span>
      )}

      {hasChildren && <ul className={styles.submenu}>{children}</ul>}
    </li>
  )
}
