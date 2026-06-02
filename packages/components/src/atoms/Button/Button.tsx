import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Link } from '../Link/Link'
import type { LinkProps } from '../Link/Link'
import styles from './Button.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'text' | 'solid' | 'outlined'
export type ButtonColor = 'primary' | 'secondary' | 'tertiary' | 'black' | 'white'

type ButtonAsButton = Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'className'>

type ButtonAsLink = Omit<LinkProps, 'children' | 'className' | 'type'>

type OwnProps = {
  children: ReactNode
  className?: string
  /**
   * Visual style of the button.
   * - `solid`    — filled background (default)
   * - `outlined` — transparent background with a coloured border
   * - `text`     — no border or background, just coloured text
   */
  variant?: ButtonVariant
  /**
   * Colour token to apply.
   * - `black`     — default
   * - `white`     — for use on dark backgrounds
   * - `primary`   — brand primary colour
   * - `secondary` — brand secondary colour
   */
  color?: ButtonColor
}

/**
 * Renders as a native `<button>` when no `href` is supplied, or as an
 * `<atom/Link>` (with its internal/external routing logic) when `href` is
 * present. Visual appearance is controlled via `variant` and `color`.
 *
 * Button:   <Button onClick={save}>Save</Button>
 * Link:     <Button href="/checkout" variant="solid" color="primary">Continue</Button>
 * Outlined: <Button variant="outlined" color="secondary">Learn more</Button>
 * Text:     <Button variant="text" color="primary">Cancel</Button>
 */
export type ButtonProps = OwnProps & (ButtonAsLink | ButtonAsButton)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLinkProps(props: ButtonAsLink | ButtonAsButton): props is ButtonAsLink {
  return 'href' in props
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button(props: ButtonProps) {
  if (isLinkProps(props)) {
    const { children, className, variant = 'solid', color = 'black', ...linkProps } = props

    return (
      <Link
        className={clsx(styles.root, className)}
        {...linkProps}
        data-variant={variant}
        data-color={color}
      >
        {children}
      </Link>
    )
  }

  const { children, className, variant = 'solid', color = 'black', ...buttonProps } = props

  return (
    <button
      className={clsx(styles.root, className)}
      {...buttonProps}
      data-variant={variant}
      data-color={color}
    >
      {children}
    </button>
  )
}
