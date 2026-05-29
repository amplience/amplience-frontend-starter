import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import styles from './Typography.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption'

type OwnProps = {
  /** Visual style to apply, independent of the rendered HTML element. */
  variant?: TypographyVariant
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
// Component
// ---------------------------------------------------------------------------

export function Typography<E extends ElementType = 'p'>({
  as,
  variant = 'body',
  className,
  children,
  ...rest
}: TypographyProps<E>) {
  const El = as ?? 'p'

  const variantClass = styles[variant] ?? ''
  const classes = [styles['root'], variantClass, className].filter(Boolean).join(' ')

  return (
    <El className={classes} {...rest}>
      {children}
    </El>
  )
}
