import clsx from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

import { Tag } from '../../atoms/Tag/Tag'
import type { TagColor } from '../../atoms/Tag/Tag'
import styles from './Tags.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TagsProps = {
  /** The tag label strings to render. */
  tags: readonly string[]
  className?: string
  /**
   * Colour applied to every tag. Override per-tag by rendering `<Tag>`
   * individually instead.
   */
  color?: TagColor
} & Omit<ComponentPropsWithoutRef<'ul'>, 'children' | 'className' | 'color'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tags molecule — renders an array of label strings as `<Tag>` pills in a
 * flex-wrap row with `gap: var(--spacing-2)`.
 *
 *   <Tags tags={['amplience', 'cms', 'getting-started']} />
 *   <Tags tags={article.tags} color="primary" />
 */
export function Tags({ tags, className, color, ...rest }: TagsProps) {
  if (tags.length === 0) return null
  return (
    <ul className={clsx('Tags', styles.root, className)} {...rest}>
      {tags.map((tag) => (
        <li key={tag} className={styles.item}>
          <Tag {...(color !== undefined && { color })}>{tag}</Tag>
        </li>
      ))}
    </ul>
  )
}
