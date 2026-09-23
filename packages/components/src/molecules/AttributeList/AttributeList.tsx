import clsx from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

import styles from './AttributeList.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Attribute = {
  label: string
  value: string
}

export type AttributeListProps = {
  /** Label/value pairs, rendered in the order given. */
  attributes: readonly Attribute[]
  className?: string
} & Omit<ComponentPropsWithoutRef<'dl'>, 'children' | 'className'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AttributeList molecule — display-only spec rows as a description list.
 *
 * A `<dl>` rather than a table: these are name/value pairs about one subject,
 * which is exactly what a description list is for, and it gives assistive
 * tech the label↔value association without any ARIA. A table would imply a
 * second axis that isn't there.
 *
 * Renders nothing for an empty list, so a caller can pass a possibly-absent
 * array without guarding.
 *
 *   <AttributeList attributes={[{ label: 'Material', value: 'Oak' }]} />
 */
export function AttributeList({ attributes, className, ...rest }: AttributeListProps) {
  if (attributes.length === 0) return null

  return (
    <dl className={clsx('AttributeList', styles.root, className)} {...rest}>
      {attributes.map((attribute) => (
        // Label is not guaranteed unique — two rows can share one ("Size" for
        // two dimensions) — so the key pairs it with the value.
        <div key={`${attribute.label}:${attribute.value}`} className={styles.row}>
          <dt className={styles.label}>{attribute.label}</dt>
          <dd className={styles.value}>{attribute.value}</dd>
        </div>
      ))}
    </dl>
  )
}
