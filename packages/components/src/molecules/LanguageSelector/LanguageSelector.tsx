'use client'

import clsx from 'clsx'
import { usePathname, useRouter } from 'next/navigation'
import { useId } from 'react'

import styles from './LanguageSelector.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One selectable locale — the URL slug and a human label to show. */
export type SelectorLocale = {
  /** URL slug, e.g. `fr-fr`. The default locale's slug is also its unprefixed identity. */
  readonly slug: string
  /** Display label, e.g. `Français (FR)`. */
  readonly label: string
}

export type LanguageSelectorProps = {
  /**
   * The locales this deployment serves, supplied by the deployment (the
   * library's default registry entry passes an empty list, so the selector
   * renders nothing until a deployment wires its locale config in). The first
   * entry is treated as the default (unprefixed) locale via `defaultSlug`.
   */
  readonly locales: readonly SelectorLocale[]
  /** Slug of the default locale — the one served without a URL prefix. */
  readonly defaultSlug: string
  /** Accessible label for the control. Defaults to "Language". */
  readonly label?: string
  readonly className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LanguageSelector molecule (ADR-0015) — swaps the active locale, keeping the
 * reader on the same page.
 *
 * A content type placeable in the header or footer, like the menu-toggle
 * button. It reads the current path, strips the current locale prefix to find
 * the locale-independent path, and navigates to that path under the chosen
 * locale — `/de-de/about` → French → `/fr-fr/about`; → the default locale →
 * `/about`. The default locale is unprefixed, matching the routing seam.
 *
 * Behaviour:
 *   - Fewer than two locales → renders nothing (there's nothing to switch).
 *   - Two or more → a native `<select>` that navigates on change. A future
 *     two-locale toggle-switch treatment is tracked separately.
 *
 * A client component: it needs the current path and client navigation. It's
 * the only client island in the otherwise server-rendered chrome, and ships
 * no locale data of its own — the list arrives as props, computed once by the
 * deployment.
 */
export function LanguageSelector({
  locales,
  defaultSlug,
  label,
  className,
}: LanguageSelectorProps) {
  const pathname = usePathname()
  const router = useRouter()
  const selectId = useId()

  // Nothing to switch between — don't render a dead control.
  if (locales.length < 2) return null

  const slugs = new Set(locales.map((l) => l.slug))
  const segments = pathname.split('/')
  const firstSegment = segments[1] ?? ''
  const hasPrefix = slugs.has(firstSegment)

  // The locale-independent path: drop the current locale prefix if present.
  const rawClean = hasPrefix ? `/${segments.slice(2).join('/')}` : pathname
  const cleanPath = rawClean === '' ? '/' : rawClean
  const currentSlug = hasPrefix ? firstSegment : defaultSlug

  const targetFor = (slug: string): string => {
    if (slug === defaultSlug) return cleanPath
    return cleanPath === '/' ? `/${slug}` : `/${slug}${cleanPath}`
  }

  return (
    <select
      id={selectId}
      className={clsx(styles.root, className)}
      aria-label={label ?? 'Language'}
      value={currentSlug}
      onChange={(event) => router.push(targetFor(event.target.value))}
    >
      {locales.map(({ slug, label: optionLabel }) => (
        <option key={slug} value={slug}>
          {optionLabel}
        </option>
      ))}
    </select>
  )
}
