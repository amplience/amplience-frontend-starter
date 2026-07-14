'use client'

import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useId } from 'react'

import styles from './LocaleSelector.module.css'

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

export type LocaleSelectorProps = {
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
  /**
   * When set, the selector switches locale by updating this **query parameter**
   * on the current path (preserving other params) instead of swapping the URL
   * path prefix. This is for contexts where locale isn't a path segment — the
   * visualization pane, which addresses content by delivery ID and carries the
   * locale as `?locale=` (ADR-0015). On the site, leave it unset for the
   * default path-prefix behaviour.
   */
  readonly localeParam?: string
  readonly className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LocaleSelector molecule (ADR-0015) — swaps the active locale, keeping the
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
export function LocaleSelector({
  locales,
  defaultSlug,
  label,
  localeParam,
  className,
}: LocaleSelectorProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectId = useId()

  // Nothing to switch between — don't render a dead control.
  if (locales.length < 2) return null

  const slugs = new Set(locales.map((l) => l.slug))

  let currentSlug: string
  let navigate: (slug: string) => void

  if (localeParam !== undefined) {
    // Query-param mode (visualization pane): locale lives in `?<localeParam>=`,
    // not the path. Accept a slug or a delivery code (`de-DE`) case-insensitively;
    // write the slug and preserve the other params (vse, content, …).
    const raw = searchParams.get(localeParam)?.toLowerCase()
    currentSlug = raw !== undefined && slugs.has(raw) ? raw : defaultSlug
    navigate = (slug) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(localeParam, slug)
      router.push(`${pathname}?${params.toString()}`)
    }
  } else {
    // Path-prefix mode (site): swap the `[locale]` segment, keeping the page.
    const segments = pathname.split('/')
    const firstSegment = segments[1] ?? ''
    const hasPrefix = slugs.has(firstSegment)
    const rawClean = hasPrefix ? `/${segments.slice(2).join('/')}` : pathname
    const cleanPath = rawClean === '' ? '/' : rawClean
    currentSlug = hasPrefix ? firstSegment : defaultSlug
    navigate = (slug) => {
      const target =
        slug === defaultSlug ? cleanPath : cleanPath === '/' ? `/${slug}` : `/${slug}${cleanPath}`
      router.push(target)
    }
  }

  return (
    <select
      id={selectId}
      className={clsx(styles.root, className)}
      aria-label={label ?? 'Language'}
      value={currentSlug}
      onChange={(event) => navigate(event.target.value)}
    >
      {locales.map(({ slug, label: optionLabel }) => (
        <option key={slug} value={slug}>
          {optionLabel}
        </option>
      ))}
    </select>
  )
}
