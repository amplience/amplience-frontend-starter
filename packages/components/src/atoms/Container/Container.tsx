import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './Container.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Max-width breakpoint tokens. Maps to CSS classes that cap the content width
 * at sensible editorial widths; the value `full` removes the cap entirely.
 *
 * Narrower values suit focused editorial content; `wide` suits dashboards
 * or media-rich layouts.
 */
export type ContainerMaxWidth = 'narrow' | 'default' | 'wide' | 'full'

export type ContainerProps = {
  children: ReactNode
  className?: string
  /**
   * Upper bound on the content width. Horizontally centred via `margin-inline: auto`.
   * Defaults to `"default"` (a comfortable reading width for body content).
   */
  maxWidth?: ContainerMaxWidth
  /**
   * When true, removes the horizontal gutter so content runs to the edge of
   * the container. Useful for full-width media (images, video, colour bands)
   * inside a section that otherwise uses the standard gutter.
   *
   * The max-width cap still applies — `gutter` only removes padding, not width.
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
 *   <Container maxWidth="full">…</Container>
 *   <Container gutter>…</Container>          — no horizontal padding
 *   <Container maxWidth="full" gutter>…</Container>  — truly edge-to-edge
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
      className={clsx(styles.root, className)}
      data-max-width={maxWidth}
      data-gutter={gutter ? 'true' : undefined}
      {...rest}
    >
      {children}
    </div>
  )
}
