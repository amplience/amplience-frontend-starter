import clsx from 'clsx'

import { Icon } from '../../atoms/Icon/Icon'
import type { IconName } from '../../atoms/Icon/Icon'
import { Link } from '../../atoms/Link/Link'
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
  /**
   * Disables the button variant — rendered as the native `disabled` attribute,
   * so the browser handles the click suppression and the removal from the tab
   * order. Ignored for the link variant, where there is no such concept (a
   * link that shouldn't be followed shouldn't be rendered).
   *
   * Native `disabled` takes focus off the element, so a user who holds a
   * disabled-at-the-end control (e.g. a carousel's next arrow) loses their
   * place in the tab order. That's the accepted trade for correct semantics;
   * an `aria-disabled` treatment that stays focusable can be layered on later
   * without changing this prop.
   */
  disabled?: boolean
  /**
   * ID of the element this button operates on — rendered as `aria-controls` so
   * assistive technology can associate the two. Used by controls that sit
   * outside the region they drive, such as a carousel's arrows.
   */
  controls?: string
  visibility?: 'mobileOnly' | 'desktopOnly'
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
 * IconButton molecule — a clickable, tappable icon from the design system's icon set.
 *
 * When `link` is provided the button renders as `<a>` for navigation. Without
 * `link` it renders as `<button type="button">` — the brand or application
 * layer attaches the click handler (e.g. to open a cart drawer).
 *
 * The button variant additionally supports `disabled` and `controls`
 * (aria-controls), for controls that drive a region elsewhere on the page and
 * have unavailable states — a carousel's prev/next arrows being the case that
 * introduced them.
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
  disabled,
  controls,
  visibility,
  localeBasePath,
  className,
}: IconButtonProps) {
  const inner = <Icon name={icon} size={24} />
  const classes = clsx('IconButton', styles.root, visibility && styles[visibility], className)

  if (link) {
    return (
      <Link
        href={link}
        className={classes}
        {...(localeBasePath !== undefined && { localeBasePath })}
        aria-label={label}
      >
        {inner}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      disabled={disabled}
      onClick={onClick}
    >
      {inner}
    </button>
  )
}
