import clsx from 'clsx'
import NextLink from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './Link.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LinkProps = {
  /** The URL to navigate to. Determines internal vs external rendering. */
  href: string
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<typeof NextLink>, 'href' | 'children' | 'className'>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true for absolute URLs (http://, https://, //) and mailto:/tel:
 * links. Everything else — paths starting with /, #, or relative segments —
 * is treated as internal and routed through Next/Link.
 */
function isExternal(href: string): boolean {
  return /^([a-z][a-z\d+\-.]*:|\/\/)/.test(href)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders an internal link via Next/Link (same-tab, client-side navigation)
 * or an external link via a plain <a> (new tab, noopener).
 *
 * Usage:
 *   <Link href="/about">About us</Link>
 *   <Link href="https://example.com" title="Visit Example">Example</Link>
 */
export function Link({ href, children, className, ...rest }: LinkProps) {
  const classes = clsx(styles.root, className)

  if (isExternal(href)) {
    return (
      <a target="_blank" rel="noopener noreferrer" {...rest} href={href} className={classes}>
        {children}
      </a>
    )
  }

  return (
    <NextLink {...rest} href={href} className={classes}>
      {children}
    </NextLink>
  )
}
