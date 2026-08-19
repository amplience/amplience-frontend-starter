'use client'

import clsx from 'clsx'
import { useCallback, useEffect, useState } from 'react'

import { IconButton } from '../IconButton/IconButton'
import styles from './MenuToggleButton.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MenuToggleButtonProps = {
  /**
   * Accessible label for screen readers. Defaults to "Toggle menu" — an
   * empty or missing label falls back rather than shipping an inaccessible
   * icon-only button.
   */
  label?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The menus this button toggles: every Menu on the page that opted into the
 * mobile drawer layout. Menus without `data-mobile-layout` have no drawer to
 * open, so they are never touched.
 *
 * Page-wide targeting is a deliberate v1 simplification: pages almost always
 * have exactly one mobile-layout menu, and when an author places several, one
 * hamburger opening all of them is coherent behaviour rather than a bug.
 * Tighter scoping (nearest-header ancestry, or an explicit target field) can
 * be layered on later without breaking this contract.
 */
const TARGET_SELECTOR = 'nav.Menu[data-mobile-layout]'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MenuToggleButton molecule — the hamburger button that opens and closes the
 * mobile menu drawer.
 *
 * Menu.tsx ships no JavaScript by design: its drawer CSS keys off `data-open`
 * on the `<nav>` and it documents the toggle as an application-layer concern.
 * This component is that application layer — a small client component that
 * flips `data-open` on every mobile-layout Menu on the page (see
 * TARGET_SELECTOR above for the targeting rationale).
 *
 * The button's own state is the source of truth: each click *sets* (rather
 * than flips) `data-open` on all targets, so menus can never drift out of
 * sync with the button or each other. `aria-expanded` mirrors the state and
 * the icon swaps menu ↔ x, the conventional hamburger affordance.
 *
 * An open drawer closes on the next click anywhere on the page, so following
 * any link — inside the drawer or outside it — leaves it behind, and a tap on
 * the page dismisses it the way an overlay is expected to behave.
 *
 * Fail-loud: clicking with no mobile-layout Menu on the page warns to the
 * console instead of silently doing nothing.
 *
 * Visibility: hidden above the Menu drawer breakpoint (768px) by default —
 * the drawer CSS only exists below it, so on desktop the button would be a
 * dead control. Brands can override via the `.MenuToggleButton` class.
 */
export function MenuToggleButton({ label, className }: MenuToggleButtonProps) {
  const [open, setOpen] = useState(false)

  /** Reflects a new state onto both the button and the `data-open` the drawer CSS reads. */
  const setMenusOpen = useCallback((next: boolean) => {
    for (const nav of document.querySelectorAll(TARGET_SELECTOR)) {
      if (next) {
        nav.setAttribute('data-open', '')
      } else {
        nav.removeAttribute('data-open')
      }
    }
    setOpen(next)
  }, [])

  const handleClick = useCallback(() => {
    if (document.querySelectorAll(TARGET_SELECTOR).length === 0) {
      console.warn(
        `MenuToggleButton: no "${TARGET_SELECTOR}" found on the page — nothing to toggle. ` +
          'Add a Menu with useMobileLayout enabled, or remove this button.',
      )
      return
    }
    setMenusOpen(!open)
  }, [open, setMenusOpen])

  // Any click while open closes the drawer — link taps (including one to the
  // current page, where no route change would fire), and clicks off the menu.
  // Bubble phase, so a link's own navigation is already under way first.
  // When mobile submenus land, parent items will need excluding here.
  useEffect(() => {
    if (!open) return
    const close = () => setMenusOpen(false)
    document.addEventListener('click', close)
    return () => {
      document.removeEventListener('click', close)
    }
  }, [open, setMenusOpen])

  return (
    <IconButton
      icon={open ? 'x' : 'menu'}
      label={label?.trim() ? label : 'Toggle menu'}
      onClick={handleClick}
      expanded={open}
      className={clsx('MenuToggleButton', styles.root, className)}
    />
  )
}
