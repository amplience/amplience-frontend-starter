/**
 * Brand resolution for the built-in Local Fixtures source.
 *
 * Fixtures store their brand in `amplience.config.json` (`fixturesBrand`) and
 * the Environment Manager writes it to NEXT_PUBLIC_BRAND when fixtures are the
 * active source. A blank value writes no var at all, which apps/web reads as
 * `data-brand="default"` — so blank and "default" describe the same rendering.
 */

/** What apps/web themes with when NEXT_PUBLIC_BRAND is unset (see app/layout.tsx). */
export const DEFAULT_BRAND = 'default'

/** The brand the app actually renders under, given what's saved in config. */
export function resolveFixturesBrand(brand: string | undefined): string {
  return (brand ?? '').trim() || DEFAULT_BRAND
}
