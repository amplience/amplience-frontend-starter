import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './Container.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Max-width breakpoint tokens. Maps to CSS classes that cap the content width
 * at sensible editorial widths; the value `none` removes the cap entirely.
 *
 * Narrower values suit focused editorial content; `wide` suits dashboards
 * or media-rich layouts.
 */
export type ContainerMaxWidth = 'narrow' | 'default' | 'wide' | 'none'

export type ContainerProps = {
  children: ReactNode
  className?: string
  /**
   * Upper bound on the content width. Horizontally centred via `margin-inline: auto`.
   * Defaults to `"default"` (a comfortable reading width for body content).
   */
  maxWidth?: ContainerMaxWidth
  /**
   * When true, adds horizontal padding (`--site-gutter`) so content is inset
   * from the container edge. Omit or set false for edge-to-edge content such
   * as full-width media or colour bands.
   *
   * The max-width cap still applies — `gutter` only controls padding, not width.
   */
  gutter?: boolean
} & Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A horizontally-centred, max-width wrapper. The root `<div>` adds horizontal
 * padding (via `--site-gutter`) and caps width via `--site-max-width-*` tokens.
 * Vertical rhythm is the parent's concern — Container never adds block margins
 * or padding.
 *
 * Usage:
 *   <Container>…</Container>
 *   <Container maxWidth="wide">…</Container>
 *   <Container maxWidth="narrow">…</Container>
 *   <Container maxWidth="none">…</Container>
 *   <Container gutter>…</Container>          — adds horizontal padding
 *   <Container maxWidth="none">…</Container>  — truly edge-to-edge (no gutter, no max-width cap)
 */
export function Container({
  children,
  className,
  maxWidth = 'default',
  gutter = false,
  ...rest
}: ContainerProps) {
  return (
    <div
      className={clsx('Container', styles.root, className)}
      data-max-width={maxWidth}
      data-gutter={gutter ? 'true' : undefined}
      {...rest}
    >
      {children}
    </div>
  )
}
