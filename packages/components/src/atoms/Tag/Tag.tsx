import clsx from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

import styles from './Tag.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Visual colour of the tag pill.
 *   default   — neutral surface (gray-100 bg, gray-700 text)
 *   primary   — brand primary
 *   secondary — brand secondary
 *   tertiary  — brand tertiary
 */
export type TagColor = 'default' | 'primary' | 'secondary' | 'tertiary'

export type TagProps = {
  children: string
  className?: string
  color?: TagColor
} & Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'className' | 'color'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tag atom — a small coloured pill label. Use in `<Tags>` for a row, or
 * standalone wherever a single label is needed.
 *
 *   <Tag>getting-started</Tag>
 *   <Tag color="primary">featured</Tag>
 */
export function Tag({ children, className, color = 'default', ...rest }: TagProps) {
  return (
    <span className={clsx(styles.root, className)} data-color={color} {...rest}>
      {children}
    </span>
  )
}
