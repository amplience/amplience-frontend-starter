'use client'

import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useId, useSyncExternalStore } from 'react'

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
   *
   * Inside an iframe the selector is disabled: the pane is embedded in the
   * Amplience content form, whose own locale picker decides the locale, so a
   * second control would only drift out of sync with it. Outside an iframe it
   * switches as usual.
   */
  readonly localeParam?: string
  /**
   * A non-locale prefix the site is served under, e.g. `/preview/<host>` in a
   * schedule preview (ADR-0028). Path-prefix mode strips it before reading the
   * locale and puts it back on the target, so switching stays inside it.
   */
  readonly pathPrefix?: string
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
function PathPrefixSelector({
  locales,
  defaultSlug,
  label,
  pathPrefix = '',
  className,
}: LocaleSelectorProps) {
  const fullPathname = usePathname()
  const router = useRouter()

  const inPrefix =
    pathPrefix !== '' && (fullPathname === pathPrefix || fullPathname.startsWith(`${pathPrefix}/`))
  const pathname = inPrefix ? fullPathname.slice(pathPrefix.length) || '/' : fullPathname
  const prefix = inPrefix ? pathPrefix : ''

  const slugs = new Set(locales.map((l) => l.slug))
  const segments = pathname.split('/')
  // Lowercased: the middleware serves a mis-cased locale (`/EN-US/…`) in place.
  const firstSegment = (segments[1] ?? '').toLowerCase()
  const hasPrefix = slugs.has(firstSegment)
  const rawClean = hasPrefix ? `/${segments.slice(2).join('/')}` : pathname
  const cleanPath = rawClean === '' ? '/' : rawClean
  const currentSlug = hasPrefix ? firstSegment : defaultSlug

  const navigate = (slug: string) => {
    const target =
      slug === defaultSlug ? cleanPath : cleanPath === '/' ? `/${slug}` : `/${slug}${cleanPath}`
    router.push(prefix !== '' && target === '/' ? prefix : `${prefix}${target}`)
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
 * writes the slug and preserves the other params (vse, content, …). Disabled
 * when embedded in an iframe, where the host's locale picker is in charge.
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
  const embedded = useSyncExternalStore(subscribeNever, isEmbedded, isNotEmbedded)

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
      disabled={embedded}
      title={
        embedded
          ? "The locale picker is disabled while embedded.\nUse the visualizer's locale picker instead."
          : undefined
      }
    />
  )
}

// Whether the page sits in an iframe. A browser fact that never changes after
// load, so there is nothing to subscribe to; the server snapshot says "not
// embedded", which makes the control enabled in the server HTML and disabled
// once the client hydrates.
const noop = () => undefined
const subscribeNever = () => noop
const isEmbedded = () => window.self !== window.top
const isNotEmbedded = () => false

/** Shared presentation: the native `<select>` both modes render. */
type LocaleSelectProps = {
  readonly locales: readonly SelectorLocale[]
  readonly label?: string | undefined
  readonly className?: string | undefined
  readonly currentSlug: string
  readonly onNavigate: (slug: string) => void
  readonly disabled?: boolean
  readonly title?: string | undefined
}

function LocaleSelect({
  locales,
  label,
  className,
  currentSlug,
  onNavigate,
  disabled = false,
  title,
}: LocaleSelectProps) {
  const selectId = useId()

  return (
    <label htmlFor={selectId} className={clsx('LocaleSelector', styles.root)} title={title}>
      <select
        id={selectId}
        className={clsx(styles.select, className)}
        aria-label={label ?? 'Language'}
        value={currentSlug}
        disabled={disabled}
        onChange={(event) => onNavigate(event.target.value)}
      >
        {locales.map(({ slug, label: optionLabel }) => (
          <option key={slug} value={slug}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
