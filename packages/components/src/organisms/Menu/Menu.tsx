import clsx from 'clsx'
import { Children, Fragment, isValidElement, type ReactNode } from 'react'

import { IconButton } from '../../molecules/IconButton/IconButton'
import styles from './Menu.module.css'

/**
 * True when a rendered child is an IconButton.
 *
 * The dispatcher renders each content child and wraps it in a keyed
 * `<Fragment>`, so we unwrap one Fragment layer before comparing the element
 * type against the `IconButton` component reference.
 */
const isIconButtonNode = (node: ReactNode): boolean => {
  if (!isValidElement(node)) return false
  const inner = node.type === Fragment ? (node.props as { children?: ReactNode }).children : node
  return isValidElement(inner) && inner.type === IconButton
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MenuDisplay = 'dropdownOnHover' | 'megaMenuOnHover' | 'megaMenu'

export type MenuProps = {
  /**
   * When true, applies `data-mobile-layout` which CSS uses to hide the item
   * list and show a hamburger toggle on small viewports. The toggle itself
   * is a brand/application concern — add a button and toggle `data-open` on
   * the nav element via JavaScript.
   */
  useMobileLayout?: boolean
  /** Controls how the menu renders its submenus. Defaults to dropdownOnHover. */
  display?: MenuDisplay
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
 *
 * Icon buttons:
 *   MenuItem children render as `<li>`s in the main `<ul>`. Any IconButton
 *   children (e.g. mobile cart/account links authored on the hierarchy menu)
 *   are grouped after the list in a `.iconGroup` flex row, so they form a
 *   horizontal, wrapping strip of icons at the end of the menu rather than
 *   sitting among the text links.
 */
export function Menu({
  useMobileLayout = false,
  display = 'dropdownOnHover',
  children,
  className,
}: MenuProps) {
  const items: ReactNode[] = []
  const icons: ReactNode[] = []
  Children.forEach(children, (child) => {
    ;(isIconButtonNode(child) ? icons : items).push(child)
  })

  return (
    <nav
      className={clsx('Menu', styles.root, className)}
      data-mobile-layout={useMobileLayout || undefined}
      data-display={display}
      aria-label="Site navigation"
    >
      <ul className={styles.list}>{items}</ul>
      {icons.length > 0 && <div className={styles.iconGroup}>{icons}</div>}
    </nav>
  )
}
