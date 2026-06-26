import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './HeaderRow.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeaderRowColorToken =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'light'
  | 'dark'
  | 'black'
  | 'white'

export type HeaderRowProps = {
  /**
   * Background colour token for this row. Applied via a data attribute so
   * brands can override the resolved value under [data-brand] without
   * touching this component.
   */
  backgroundColor?: HeaderRowColorToken
  /**
   * Foreground (text + icon) colour token for this row. Inherits down the
   * tree so Logos and IconButtons pick it up automatically.
   */
  foregroundColor?: HeaderRowColorToken
  children?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HeaderRow molecule — a single horizontal row within the site header.
 *
 * Renders a flex row with horizontal gutter padding. Background and
 * foreground colours are set via data attributes and resolved to brand
 * tokens in the CSS. Each row carries its own palette independently, so
 * a logo row can be white-on-black while a nav row is primary-on-white.
 *
 * Items (Logo, Menu, IconButton) are passed in as `children` by the renderer.
 *
 * Brand overrides (no component changes required):
 *   [data-brand="acme"] [data-background-color="primary"] { background-color: #003; }
 */
export function HeaderRow({
  backgroundColor,
  foregroundColor,
  children,
  className,
}: HeaderRowProps) {
  return (
    <div
      className={clsx(styles.root, className)}
      data-background-color={backgroundColor}
      data-foreground-color={foregroundColor}
    >
      {children}
    </div>
  )
}
