import clsx from 'clsx'

import { Icon } from '../../atoms/Icon/Icon'
import type { IconName } from '../../atoms/Icon/Icon'
import styles from './IconButton.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IconButtonProps = {
  /** Icon to render — must be a name from the design system's curated set. */
  icon: IconName
  /**
   * Accessible label for screen readers. Passed through to the Icon atom and
   * set as aria-label on the interactive element. Required for all icon-only
   * buttons and links.
   */
  label: string
  /**
   * When provided, renders an `<a>` tag instead of a `<button>`. Use for
   * navigation (e.g. cart page, account page). Omit for actions that require
   * JavaScript handlers (which should be wired up by the parent or brand layer).
   */
  link?: string
  /**
   * Click handler for the button variant. Only meaningful when `link` is
   * omitted (a link navigates; it doesn't need a handler) — ignored when
   * `link` is set. Functions can't cross the server/client boundary, so
   * this is only passable from a client component (e.g. MenuToggleButton).
   */
  onClick?: () => void
  /**
   * When the button controls a disclosure (drawer, menu, panel), pass its
   * open state here — rendered as `aria-expanded` on the button variant so
   * screen readers announce the state. Omit for plain action buttons.
   */
  expanded?: boolean
  visibility?: 'mobileOnly' | 'desktopOnly'
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * IconButton molecule — a clickable, tappable icon from the design system's icon set.
 *
 * When `link` is provided the button renders as `<a>` for navigation. Without
 * `link` it renders as `<button type="button">` — the brand or application
 * layer attaches the click handler (e.g. to open a cart drawer).
 *
 * The icon inherits `color: currentColor` so the HeaderRow's foreground
 * colour token applies automatically without any extra props.
 *
 * Accessibility: `label` is required and supplied as `aria-label` on the
 * interactive wrapper. The Icon itself is decorative (`aria-hidden="true"`
 * from the Icon atom when no label is forwarded).
 */
export function IconButton({
  icon,
  label,
  link,
  onClick,
  expanded,
  visibility,
  className,
}: IconButtonProps) {
  const inner = <Icon name={icon} size={24} />
  const classes = clsx('IconButton', styles.root, visibility && styles[visibility], className)

  if (link) {
    return (
      <a href={link} className={classes} aria-label={label}>
        {inner}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
    >
      {inner}
    </button>
  )
}
