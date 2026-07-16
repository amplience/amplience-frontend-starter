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
  /**
   * Active locale URL prefix (ADR-0015) — `/fr-fr`, or `''`/undefined for the
   * default locale. Internal links are kept inside this locale: a root-relative
   * href like `/about` becomes `/fr-fr/about`. This is the one place link
   * localization happens, so every link across the design system stays in the
   * reader's locale — including links inside rendered markdown. The language
   * selector is the deliberate exception: it builds its targets from
   * `publicPath` so it *can* cross locales. External, anchor, and
   * already-prefixed links are left untouched.
   */
  localeBasePath?: string
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

/**
 * Prefix an internal href with the active locale base. Only root-relative
 * paths (`/about`) are rewritten; anchors (`#…`), relative segments, and
 * hrefs already under the base pass through, so the operation is idempotent.
 * The bare root `/` maps to the base itself (`/fr-fr`), not `/fr-fr/`.
 */
function withLocaleBase(href: string, base: string): string {
  if (base === '') return href
  if (href === '/') return base
  if (!href.startsWith('/')) return href
  if (href === base || href.startsWith(`${base}/`)) return href
  return `${base}${href}`
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
export function Link({ href, children, className, localeBasePath = '', ...rest }: LinkProps) {
  const classes = clsx('Link', styles.root, className)

  // External links are never localized. `localeBasePath` is destructured out
  // above so it never reaches the DOM.
  if (isExternal(href)) {
    return (
      <a target="_blank" rel="noopener noreferrer" {...rest} href={href} className={classes}>
        {children}
      </a>
    )
  }

  return (
    <NextLink {...rest} href={withLocaleBase(href, localeBasePath)} className={classes}>
      {children}
    </NextLink>
  )
}
