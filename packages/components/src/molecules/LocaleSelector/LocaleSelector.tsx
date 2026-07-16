'use client'

import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useId } from 'react'

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
 *
 * Two modes, split by component:
 *   - Path-prefix mode (the site) reads only `usePathname()` / `useRouter()`,
 *     so the pages that render it stay statically prerenderable.
 *   - Query-param mode (the visualization pane) additionally reads
 *     `useSearchParams()`, which forces a client-side-rendering bailout unless
 *     it sits inside a Suspense boundary (Next.js CSR-bailout rule). Only this
 *     variant is Suspense-wrapped, so the site never pays for it.
 */
export function LocaleSelector(props: LocaleSelectorProps) {
  // Nothing to switch between — don't render a dead control (or reach for any
  // navigation hooks).
  if (props.locales.length < 2) return null

  if (props.localeParam !== undefined) {
    return (
      <Suspense fallback={null}>
        <QueryParamSelector {...props} localeParam={props.localeParam} />
      </Suspense>
    )
  }

  return <PathPrefixSelector {...props} />
}

/**
 * Path-prefix mode (site): swap the `[locale]` segment, keeping the same page.
 * `/de-de/about` → French → `/fr-fr/about`; → the default locale → `/about`.
 */
function PathPrefixSelector({ locales, defaultSlug, label, className }: LocaleSelectorProps) {
  const pathname = usePathname()
  const router = useRouter()

  const slugs = new Set(locales.map((l) => l.slug))
  const segments = pathname.split('/')
  const firstSegment = segments[1] ?? ''
  const hasPrefix = slugs.has(firstSegment)
  const rawClean = hasPrefix ? `/${segments.slice(2).join('/')}` : pathname
  const cleanPath = rawClean === '' ? '/' : rawClean
  const currentSlug = hasPrefix ? firstSegment : defaultSlug

  const navigate = (slug: string) => {
    const target =
      slug === defaultSlug ? cleanPath : cleanPath === '/' ? `/${slug}` : `/${slug}${cleanPath}`
    router.push(target)
  }

  return (
    <LocaleSelect
      locales={locales}
      label={label}
      className={className}
      currentSlug={currentSlug}
      onNavigate={navigate}
    />
  )
}

/**
 * Query-param mode (visualization pane): locale lives in `?<localeParam>=`, not
 * the path. Accepts a slug or a delivery code (`de-DE`) case-insensitively;
 * writes the slug and preserves the other params (vse, content, …).
 */
function QueryParamSelector({
  locales,
  defaultSlug,
  label,
  localeParam,
  className,
}: LocaleSelectorProps & { readonly localeParam: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const slugs = new Set(locales.map((l) => l.slug))
  const raw = searchParams.get(localeParam)?.toLowerCase()
  const currentSlug = raw !== undefined && slugs.has(raw) ? raw : defaultSlug

  const navigate = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(localeParam, slug)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <LocaleSelect
      locales={locales}
      label={label}
      className={className}
      currentSlug={currentSlug}
      onNavigate={navigate}
    />
  )
}

/** Shared presentation: the native `<select>` both modes render. */
type LocaleSelectProps = {
  readonly locales: readonly SelectorLocale[]
  readonly label?: string | undefined
  readonly className?: string | undefined
  readonly currentSlug: string
  readonly onNavigate: (slug: string) => void
}

function LocaleSelect({ locales, label, className, currentSlug, onNavigate }: LocaleSelectProps) {
  const selectId = useId()

  return (
    <select
      id={selectId}
      className={clsx('LocaleSelector', styles.root, className)}
      aria-label={label ?? 'Language'}
      value={currentSlug}
      onChange={(event) => onNavigate(event.target.value)}
    >
      {locales.map(({ slug, label: optionLabel }) => (
        <option key={slug} value={slug}>
          {optionLabel}
        </option>
      ))}
    </select>
  )
}
