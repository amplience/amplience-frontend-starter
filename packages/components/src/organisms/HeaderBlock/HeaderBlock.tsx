import clsx from 'clsx'
import type { ReactNode } from 'react'

import type { ContainerProps } from '../../atoms/Container/Container'
import styles from './HeaderBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeaderBlockProps = {
  /**
   * When true, the header remains fixed at the top of the viewport on scroll.
   * Implemented via `position: sticky; top: 0` — works without JS.
   */
  sticky?: boolean
  /**
   * Max-width constraint passed through to child Containers via a CSS custom
   * property so inner rows can apply it without prop-drilling.
   */
  maxWidth?: ContainerProps['maxWidth']
  children?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HeaderBlock organism — the site-wide header wrapper.
 *
 * Renders as a `<header>` element containing one or more HeaderRow children.
 * The `sticky` prop adds position:sticky so the header tracks the viewport top
 * without JavaScript. `maxWidth` is propagated as a data attribute so nested
 * Containers can read it via CSS or a future context mechanism.
 *
 * All colour theming is delegated to child HeaderRow components. Brands
 * override via [data-brand] selectors on the CSS custom properties — no
 * changes to this file required.
 */
export function HeaderBlock({
  sticky = false,
  maxWidth = 'default',
  children,
  className,
}: HeaderBlockProps) {
  return (
    <header
      className={clsx('HeaderBlock', styles.root, className)}
      data-sticky={sticky || undefined}
      data-max-width={maxWidth}
    >
      {children}
    </header>
  )
}
