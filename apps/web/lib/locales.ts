/**
 * Locale configuration and URL ↔ delivery-locale mapping (ADR-0015).
 *
 * The one place the deployment's supported locales are resolved. Like the
 * site name (ADR-0014) and the hub catalogue seam (ADR-0003), locale config
 * is deployment data read once, in one function — the Amplience Delivery API
 * v2 does not expose a hub's locale list at request time, so the supported
 * set is operator config, not runtime discovery.
 *
 * Three forms of one locale, resolved together so the rest of the app never
 * re-derives them:
 *   - `code`     the Amplience locale, e.g. `en-GB` — the canonical identity.
 *   - `slug`     the URL segment, lowercased, e.g. `en-gb` — what appears in
 *                `/fr-fr/about` and what the middleware matches on.
 *   - `delivery` the value passed to the Delivery API, e.g. `en-GB,*` — the
 *                trailing wildcard is the fallback so a field missing the
 *                requested locale still resolves rather than coming back empty.
 *
 * Matching is literal set-membership (a `Map` keyed by slug), never a
 * runtime-compiled pattern (v1 ReDoS finding #18); the only regex is the
 * shape check below, which runs once at module load, not per request.
 *
 * Zero-config contract (mirrors ADR-0014): with no locale env set, the
 * deployment resolves to a single implicit `en-US` default. The middleware
 * still rewrites unprefixed paths to it, so the `[locale]` segment is always
 * populated, and the mock client ignores the delivery locale — the offline
 * fixture site renders unchanged, with no locale prefix ever surfaced.
 */

/** One supported locale in the three forms the app needs. */
export type Locale = {
  /** Amplience locale identity, e.g. `en-GB`. */
  readonly code: string
  /** URL path segment (lowercased code), e.g. `en-gb`. */
  readonly slug: string
  /** Delivery API `locale` value with wildcard fallback, e.g. `en-GB,*`. */
  readonly delivery: string
}

/** Resolved locale set for a deployment. */
export type LocaleConfig = {
  readonly locales: readonly Locale[]
  readonly defaultLocale: Locale
}

/**
 * The zero-config default locale code. Chosen when no locale env is set, so
 * the app always has exactly one default even offline against fixtures.
 */
export const DEFAULT_LOCALE_CODE = 'en-US'

/**
 * The shape an Amplience locale code must have: a lowercase language, an
 * optional uppercase region (`en` or `en-GB`). Validated once at composition
 * time — never matched against a request path (finding #18).
 */
const LOCALE_CODE_SHAPE = /^[a-z]{2}(?:-[A-Z]{2})?$/

/**
 * The Delivery API `locale` list for a locale: the locale itself, then the
 * site default, then a wildcard. With field-level localization there is one
 * content item per URL — a field authored only in the default locale (which,
 * given a French request, is most of them) resolves back to that default
 * rather than vanishing, and `*` catches anything authored in some third
 * locale. The default locale needs no self-fallback, so it is just `<code>,*`.
 */
const deliveryList = (code: string, defaultCode: string): string =>
  code === defaultCode ? `${code},*` : `${code},${defaultCode},*`

type EnvSource = Record<string, string | undefined>

const present = (value: string | undefined): value is string => value !== undefined && value !== ''

/**
 * Resolve the supported-locale set from the environment.
 *
 *   AMPLIENCE_LOCALES   comma-separated Amplience locale codes; the first is
 *                       the default (unprefixed) locale. e.g. `en-GB,fr-FR,de-DE`.
 *   AMPLIENCE_LOCALE    back-compat single-locale fallback when AMPLIENCE_LOCALES
 *                       is unset — this is also the value the content client
 *                       already reads as its deployment default.
 *
 * With neither set, resolves to a single `en-US` default (the zero-config
 * offline case). A malformed code fails loudly, naming the offending value —
 * a locale typo should be a boot error, not silently unmatched content.
 */
export const resolveLocales = (env: EnvSource): LocaleConfig => {
  const raw = present(env.AMPLIENCE_LOCALES)
    ? env.AMPLIENCE_LOCALES
    : present(env.AMPLIENCE_LOCALE)
      ? env.AMPLIENCE_LOCALE
      : DEFAULT_LOCALE_CODE

  const codes = raw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c !== '')

  if (codes.length === 0) {
    throw new Error(
      'AMPLIENCE_LOCALES is set but empty — give a comma-separated list of ' +
        'Amplience locale codes (e.g. "en-GB,fr-FR"), or unset it to use the ' +
        `${DEFAULT_LOCALE_CODE} default.`,
    )
  }

  // `codes.length > 0` is guaranteed above — the first entry is the default,
  // and every locale's delivery fallback chain ends at it.
  const defaultCode = codes[0]!

  const seenSlugs = new Set<string>()
  const locales = codes.map((code) => {
    if (!LOCALE_CODE_SHAPE.test(code)) {
      throw new Error(
        `AMPLIENCE_LOCALES contains "${code}", which is not a locale code — ` +
          'expected a lowercase language with an optional uppercase region ' +
          '(e.g. "en" or "en-GB").',
      )
    }
    const locale: Locale = {
      code,
      slug: code.toLowerCase(),
      delivery: deliveryList(code, defaultCode),
    }
    if (seenSlugs.has(locale.slug)) {
      throw new Error(
        `AMPLIENCE_LOCALES lists "${code}" more than once (case-insensitively) — ` +
          'each locale must appear once.',
      )
    }
    seenSlugs.add(locale.slug)
    return locale
  })

  return { locales, defaultLocale: locales[0]! }
}

// Read each variable as a *static* `process.env.X` reference, not through an
// aliased object. This module is imported by the middleware, which runs in the
// Edge runtime where only statically-analyzable env references are inlined at
// build time — a dynamic `env[name]` lookup would read `undefined` there, so
// only the default locale would ever be recognised. Static references are
// inlined for Edge and read at runtime under Node (the route/layout side), so
// both runtimes see the same configured set.
const config = resolveLocales({
  AMPLIENCE_LOCALES: process.env.AMPLIENCE_LOCALES,
  AMPLIENCE_LOCALE: process.env.AMPLIENCE_LOCALE,
})

/** Every locale this deployment serves; `locales[0]` is the default. */
export const locales: readonly Locale[] = config.locales

/** The default (unprefixed) locale. */
export const defaultLocale: Locale = config.defaultLocale

/** Slug → locale lookup — the middleware's literal membership test. */
const localeBySlug: ReadonlyMap<string, Locale> = new Map(locales.map((l) => [l.slug, l]))

/** True when a path segment is a configured locale slug (exact, lowercase). */
export const isLocaleSlug = (segment: string): boolean => localeBySlug.has(segment)

/** The locale for a slug, or `undefined` when the slug names no locale. */
export const localeForSlug = (segment: string): Locale | undefined => localeBySlug.get(segment)

/**
 * The canonical (lowercase) slug for a path segment that names a locale in any
 * casing, or `undefined` when it names no locale. `en-GB`, `EN-GB`, and
 * `en-gb` all resolve to `en-gb`. The middleware uses this to accept any
 * casing a user types while keeping a single canonical URL — a segment that
 * isn't already its canonical form is redirected to the lowercase one, so
 * `/en-GB/about` never coexists with `/en-gb/about` as a live URL (URL paths
 * are case-sensitive, so two casings would otherwise be duplicate content).
 */
export const canonicalLocaleSlug = (segment: string): string | undefined => {
  const lower = segment.toLowerCase()
  return localeBySlug.has(lower) ? lower : undefined
}

/**
 * The public URL path for a page at `cleanPath` (the site-relative path with
 * no locale, `/` or `/about`) in `locale`. The default locale is unprefixed
 * — `/about` — so existing URLs and canonicals are untouched; every other
 * locale carries its slug — `/fr-fr/about`. Feeds the self-referencing
 * canonical, so each localized page points at itself and the default has one
 * clean canonical URL.
 */
export const publicPath = (locale: Locale, cleanPath: string): string => {
  if (locale.slug === defaultLocale.slug) return cleanPath
  return cleanPath === '/' ? `/${locale.slug}` : `/${locale.slug}${cleanPath}`
}

/**
 * The URL prefix for a locale (ADR-0015): `''` for the default (unprefixed)
 * locale, `/<slug>` otherwise. Handed to the renderer as `localeBasePath` so
 * the `Link` atom keeps internal links inside the current locale.
 */
export const localeBasePath = (locale: Locale): string =>
  locale.slug === defaultLocale.slug ? '' : `/${locale.slug}`
