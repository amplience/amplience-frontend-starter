/**
 * Which currency a visitor sees — the deployment's policy, in one function.
 *
 * What a product costs is a fact about the product, and lives in content as a
 * set of prices keyed by currency. *Which* of those a given request shows is
 * a policy of the deployment, and lives here. Keeping the two apart is what
 * makes the awkward cases cheap:
 *
 *   **Currency chosen independently of locale** — a picker, a geo lookup, a
 *   cookie: change `resolveCurrency` to read that instead of the locale.
 *   Nothing else moves, because nothing else knows how the choice was made.
 *
 *   **Several currencies in one locale** — the port already returns
 *   `Product.prices`, so this is a component change (render two) rather than
 *   a data-model one.
 *
 *   **One currency across several locales** — map them to the same code.
 *
 * Had prices been *localized* in the schema instead, currency would be welded
 * to locale permanently and none of the three would be reachable without a
 * content migration. That is the reason for the shape, and it is worth not
 * undoing.
 *
 * Configuration mirrors `AMPLIENCE_LOCALES`: a comma-separated list, parsed
 * once, with a documented default so a clone needs no configuration at all.
 */

const PAIR_SEPARATOR = ','
const KEY_SEPARATOR = ':'

/**
 * Fallback when nothing is configured and the locale isn't mapped.
 *
 * A single-currency catalogue is the common case; making it work with no
 * configuration is the same instinct as the mock content client. GBP because
 * the reference fixtures are priced in it — a real deployment sets
 * `PRODUCT_CURRENCY_DEFAULT`.
 */
export const DEFAULT_CURRENCY = 'GBP'

export type CurrencyConfig = {
  /** Locale code (`en-GB`) → currency code (`GBP`). */
  readonly byLocale: ReadonlyMap<string, string>
  /** Used for any locale not in the map. */
  readonly fallback: string
}

/**
 * The env vars this module reads. An index signature rather than two optional
 * keys, so `process.env` — whose type has no properties in common with a
 * closed object type — can be passed directly.
 */
export type CurrencyEnv = Readonly<Record<string, string | undefined>>

const isCurrencyCode = (value: string): boolean => /^[A-Z]{3}$/.test(value)

/**
 * Parse `"en-GB:GBP,de-DE:EUR"` into a map.
 *
 * Malformed entries are skipped rather than throwing: an unusable pair costs
 * that locale its mapping and falls back, where a throw would take the whole
 * site down over one typo in an env var. Unlike `PRODUCT_SOURCE`, there is a
 * sane thing to do without it.
 */
export const resolveCurrencyConfig = (env: CurrencyEnv): CurrencyConfig => {
  const byLocale = new Map<string, string>()

  for (const pair of (env.PRODUCT_CURRENCIES ?? '').split(PAIR_SEPARATOR)) {
    const trimmed = pair.trim()
    if (trimmed === '') continue
    const [locale, currency] = trimmed.split(KEY_SEPARATOR).map((part) => part.trim())
    if (locale === undefined || currency === undefined) continue
    if (locale === '' || !isCurrencyCode(currency.toUpperCase())) continue
    byLocale.set(locale, currency.toUpperCase())
  }

  const configuredFallback = env.PRODUCT_CURRENCY_DEFAULT?.trim().toUpperCase()
  const fallback =
    configuredFallback !== undefined && isCurrencyCode(configuredFallback)
      ? configuredFallback
      : DEFAULT_CURRENCY

  return { byLocale, fallback }
}

const config = resolveCurrencyConfig(process.env)

/**
 * The currency for a locale.
 *
 * Takes the locale's `code` (`en-GB`), not its `slug` or `delivery` value —
 * those are the URL and Delivery API forms respectively, and confusing them
 * is a mistake this repo has already made once.
 *
 * **This is the function to change** to decouple currency from locale. It
 * takes a locale today because that is the only signal a v1.1 deployment has;
 * a picker would make it take a request instead.
 */
export const resolveCurrency = (localeCode: string, cfg: CurrencyConfig = config): string =>
  cfg.byLocale.get(localeCode) ?? cfg.fallback
