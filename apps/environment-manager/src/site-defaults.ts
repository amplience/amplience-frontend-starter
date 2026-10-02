/**
 * What a blank site name or brand on a hub's site form falls back to — so the
 * placeholders can say it, and "Add existing site" can record it, exactly as
 * "Create Vercel site" does on the server.
 *
 * The client twin of `defaultSiteName` in `../server/active-source.ts`; that
 * module reads the disk and can't be bundled, so the rule is restated here over
 * the set list the panel already fetches. Keep the two in step: `defaultSite`,
 * else the hub's `defaultFixtureSet`, else the default set — the same
 * `SITE_NAME ?? FIXTURE_SET ?? 'frontend-starter'` that hub-import and the web
 * app apply (ADR-0019, amending ADR-0014's hub-name default).
 */

import type { Environment, FixtureSetInfo } from './types.js'

/** Twin of `DEFAULT_FIXTURE_SET` in `../server/fixture-sets.ts`. */
const DEFAULT_FIXTURE_SET = 'frontend-starter'

/** The site name a blank site-name field resolves to on this hub. */
export function defaultSiteName(
  env: Pick<Environment, 'hubName' | 'defaultSite' | 'defaultFixtureSet'>,
  sets: readonly Pick<FixtureSetInfo, 'name'>[],
): string {
  const explicit = (env.defaultSite ?? '').trim()
  if (explicit !== '') return explicit
  const find = (name: string | undefined) => {
    const wanted = (name ?? '').trim()
    return wanted === '' ? undefined : sets.find((s) => s.name === wanted)
  }
  // Only an empty checkout has no sets; the hub name is then the least-bad guess.
  return (find(env.defaultFixtureSet) ?? find(DEFAULT_FIXTURE_SET) ?? sets[0])?.name ?? env.hubName
}

/**
 * The brand a blank brand field resolves to: the hub's `defaultBrand`, else the
 * app's own `default` theme. (A deployment never sees a set's `defaultBrand` —
 * that only applies offline — so it isn't part of this fallback.)
 */
export function defaultBrandName(env: Pick<Environment, 'defaultBrand'>): string {
  const explicit = (env.defaultBrand ?? '').trim()
  return explicit !== '' ? explicit : 'default'
}
