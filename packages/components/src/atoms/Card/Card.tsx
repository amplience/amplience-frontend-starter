import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './Card.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Visual treatment of the card surface.
 *   flat     — no shadow or border; background-only separation
 *   raised   — drop-shadow elevation
 *   bordered — 1px border, no shadow
 */
export type CardElevation = 'flat' | 'raised' | 'bordered'

/**
 * Internal padding scale — multiples of `--spacing`.
 *   none → 0
 *   sm   → × 2   (8px)
 *   md   → × 4   (16px)
 *   lg   → × 6   (24px)
 */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

/**
 * Card surface colour. Mirrors Button's colour vocabulary plus two
 * semantic greys for subtle and inverted surfaces.
 *   white   — default (card-white / page background)
 *   light   — gray-100, the common subtle off-white surface
 *   dark    — gray-800, for inverted cards on light pages
 *   black   — for maximum contrast (e.g. on light pages or when paired with a bright accent)
 *   primary / secondary / tertiary — brand palette
 */
export type CardColor = 'white' | 'light' | 'dark' | 'black' | 'primary' | 'secondary' | 'tertiary'

export type CardProps = {
  children: ReactNode
  className?: string
  /**
   * Visual surface treatment. Defaults to `"raised"`.
   */
  elevation?: CardElevation
  /**
   * Internal padding. Defaults to `"md"`.
   */
  padding?: CardPadding
  /**
   * Background colour of the card surface. Defaults to `"white"`.
   * Coloured cards automatically apply a contrasting foreground colour.
   */
  color?: CardColor
  /**
   * When true, adds hover and focus-visible styles suitable for a
   * clickable card (e.g. wrapped in a Link). Defaults to `false`.
   */
  interactive?: boolean
} & Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A primitive card container — a surface that visually groups related
 * content. Accepts any children; title, image, and CTA are composed at
 * the molecule layer.
 *
 * Usage:
 *   <Card>…</Card>                                  — raised, white, md padding
 *   <Card color="primary" elevation="flat">…</Card>  — brand-coloured surface
 *   <Card interactive elevation="raised">…</Card>    — clickable card
 *   <Card elevation="bordered" padding="lg">…</Card>
 */
export function Card({
  children,
  className,
  elevation = 'raised',
  padding = 'md',
  color = 'white',
  interactive = false,
  ...rest
}: CardProps) {
  return (
    <div
      className={clsx('Card', styles.root, className)}
      data-elevation={elevation}
      data-padding={padding}
      data-color={color}
      data-interactive={interactive ? 'true' : undefined}
      {...rest}
    >
      {children}
    </div>
  )
}
