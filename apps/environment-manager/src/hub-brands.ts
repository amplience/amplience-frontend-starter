import type { Environment } from './types.js'

/**
 * The distinct brands a hub renders under — its localhost first, then each
 * site's, in the order the card lists them.
 *
 * Blanks are dropped rather than shown: a site with no brand of its own falls
 * back to the hub's defaultBrand at deploy time (see server/vercel.ts), which
 * is already first in the list.
 */
export function hubBrands(env: Pick<Environment, 'defaultBrand' | 'webApps'>): string[] {
  const all = [env.defaultBrand, ...env.webApps.map((site) => site.brand)]
  return [...new Set(all.map((brand) => (brand ?? '').trim()).filter((brand) => brand !== ''))]
}
