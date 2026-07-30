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

/**
 * Opt-in inert rendering: a `<span>` styled as a button, with no href and no
 * interactive semantics. Used where a CTA is decoration because an ancestor is
 * already the link (a MediaCard whose whole surface links) — nesting an `<a>`
 * or `<button>` inside an `<a>` is invalid.
 *
 * `asSpan` is required rather than inferred: "no href and no onClick" is
 * indistinguishable from an ordinary submit button, so inferring it would
 * silently downgrade real buttons to spans.
 */
type ButtonAsSpan = Omit<ButtonAsLink, 'href'> & { asSpan: true }

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
 * Inert:    <Button asSpan variant="solid">Shop now</Button>
 */
export type ButtonProps = OwnProps & (ButtonAsLink | ButtonAsButton | ButtonAsSpan)

type ButtonVariantProps = ButtonAsLink | ButtonAsButton | ButtonAsSpan

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSpanProps(props: ButtonVariantProps): props is ButtonAsSpan {
  return 'asSpan' in props && props.asSpan === true
}

function isLinkProps(props: ButtonVariantProps): props is ButtonAsLink {
  return 'href' in props
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button(props: ButtonProps) {
  // Inert first: `asSpan` overrides the href/onClick shape so a decorative CTA
  // can keep carrying link-ish props without becoming interactive.
  // `asSpan` and `localeBasePath` are Button/Link concerns with no DOM meaning
  // here, so both are destructured out rather than spread onto the node.
  if (isSpanProps(props)) {
    const {
      children,
      className,
      variant = 'solid',
      color = 'black',
      asSpan: _asSpan,
      localeBasePath: _localeBasePath,
      ...spanProps
    } = props

    return (
      <span
        className={clsx('Button', styles.root, className)}
        {...spanProps}
        data-variant={variant}
        data-color={color}
      >
        {children}
      </span>
    )
  }

  if (isLinkProps(props)) {
    const { children, className, variant = 'solid', color = 'black', ...linkProps } = props

    return (
      <Link
        className={clsx('Button', styles.root, className)}
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
      className={clsx('Button', styles.root, className)}
      {...buttonProps}
      data-variant={variant}
      data-color={color}
    >
      {children}
    </button>
  )
}
