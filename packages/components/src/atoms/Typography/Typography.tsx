import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import styles from './Typography.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'caption'
export type TypographyAlign = 'left' | 'center' | 'right'

type OwnProps = {
  /** Visual style to apply, independent of the rendered HTML element. */
  variant?: TypographyVariant
  /**
   * Text alignment. Omit to inherit alignment from the parent container,
   * which is the right default for most layout contexts. Supply explicitly
   * when a single piece of text needs to break from its surroundings, or
   * when the value comes from a CMS-authored field.
   */
  align?: TypographyAlign
  children: ReactNode
  className?: string
}

/**
 * Polymorphic props: callers get the correct HTML attribute types for
 * whichever element they pass via `as`, while `variant` stays independent.
 *
 * Example — semantic h1 with display styling:
 *   <Typography as="h1" variant="h1">Page title</Typography>
 *
 * Example — visually large text that is semantically a paragraph:
 *   <Typography as="p" variant="h2">Intro copy</Typography>
 */
export type TypographyProps<E extends ElementType = 'p'> = OwnProps & {
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof OwnProps | 'as'>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps each visual variant to the HTML element it should render as by default.
 * `caption` is a visual style, not the `<caption>` table element — it falls
 * back to `<p>`. All other variants match their HTML counterpart.
 */
const VARIANT_ELEMENT: Record<TypographyVariant, ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  caption: 'p',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Typography<E extends ElementType = 'p'>({
  as,
  variant = 'p',
  align,
  className,
  children,
  ...rest
}: TypographyProps<E>) {
  const El = as ?? VARIANT_ELEMENT[variant]

  const variantClass = styles[variant] ?? ''
  const classes = clsx(styles.root, variantClass, className)

  return (
    <El className={classes} data-align={align} {...rest}>
      {children}
    </El>
  )
}
