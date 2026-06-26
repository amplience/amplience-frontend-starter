import clsx from 'clsx'
import type { ReactNode } from 'react'

import type { ContainerProps } from '../../atoms/Container/Container'
import styles from './FooterBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FooterBlockProps = {
  /**
   * When true, the footer remains fixed at the bottom of the viewport on scroll.
   * Implemented via `position: sticky; bottom: 0` — works without JS.
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
 * FooterBlock organism — the site-wide footer wrapper.
 *
 * Renders as a `<footer>` element containing one or more FooterRow children.
 * The `sticky` prop adds position:sticky so the footer tracks the viewport bottom
 * without JavaScript. `maxWidth` is propagated as a data attribute so nested
 * Containers can read it via CSS or a future context mechanism.
 *
 * All colour theming is delegated to child FooterRow components. Brands
 * override via [data-brand] selectors on the CSS custom properties — no
 * changes to this file required.
 */
export function FooterBlock({
  sticky = false,
  maxWidth = 'default',
  children,
  className,
}: FooterBlockProps) {
  return (
    <footer
      className={clsx(styles.root, className)}
      data-sticky={sticky || undefined}
      data-max-width={maxWidth}
    >
      {children}
    </footer>
  )
}
