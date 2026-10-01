/**
 * Fixture sets, as the Environment Manager sees them (ADR-0019).
 *
 * A set is a directory under `packages/content/fixtures/` holding a `set.json`.
 * That is the same definition the seed scripts use
 * (`packages/hub-management/scripts/lib/fixture-sets.mjs`) and the same one the
 * runtime registry in `packages/content/src/mock/loader.ts` is held against by a
 * guard test — so disk is read here too rather than either being imported. The
 * scripts are plain ESM and the registry carries no `set.json` metadata, so
 * neither is a shorter route to the label and brand this panel needs.
 *
 * Discovery is separated from resolution: reading is impure and takes a root so
 * tests can point it at a fixture tree, while `resolveFixtureSet` is pure and
 * carries the rule that decides which set a site serves.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** What a `set.json` says about itself. Only `name` is guaranteed. */
export type FixtureSetInfo = {
  name: string
  label: string
  description: string
  /** The brand a site gets when it doesn't name one of its own. */
  defaultBrand: string
  defaultLocale: string
  authoredLocales: string[]
  /** Whether `generate-docs` writes into this set. */
  generatedDocs: boolean
}

/**
 * The set a zero-config deployment gets — the twin of `FIXTURE_SITE_NAME` in
 * `packages/content/src/config.ts` and of `DEFAULT_FIXTURE_SET` in the seed
 * scripts. Duplicated rather than imported across the package boundary; a
 * mismatch surfaces at once, because the set has to exist on disk.
 */
export const DEFAULT_FIXTURE_SET = 'frontend-starter'

/** Where the sets live, relative to the repository root. */
export const fixturesRootFor = (repoRoot: string) =>
  path.join(repoRoot, 'packages', 'content', 'fixtures')

/** Everything a `set.json` omits. A set is usable with nothing but a name. */
const withDefaults = (name: string, raw: Record<string, unknown>): FixtureSetInfo => ({
  name,
  label: typeof raw.label === 'string' && raw.label !== '' ? raw.label : name,
  description: typeof raw.description === 'string' ? raw.description : '',
  defaultBrand: typeof raw.defaultBrand === 'string' ? raw.defaultBrand : '',
  defaultLocale: typeof raw.defaultLocale === 'string' ? raw.defaultLocale : '',
  authoredLocales: Array.isArray(raw.authoredLocales)
    ? raw.authoredLocales.filter((l): l is string => typeof l === 'string')
    : [],
  generatedDocs: raw.generatedDocs === true,
})

/**
 * Every set on disk, ordered by the label the panel shows.
 *
 * Sorting by directory name would order the list by something the reader can't
 * see — `anyafinn` sorts above `frontend-starter` while "Anya Finn" reads as
 * belonging below "Amplience Frontend Starter".
 *
 * A directory whose `set.json` is missing or unreadable is not a set and is
 * skipped — the panel lists what it can offer rather than failing to load over
 * one bad directory. A `set.json` naming a different set than its directory is
 * a harder problem, and the seed scripts refuse on it; here the directory name
 * wins, because it is the delivery-key prefix every item inside already carries.
 */
export function readFixtureSets(repoRoot: string): FixtureSetInfo[] {
  const root = fixturesRootFor(repoRoot)
  if (!existsSync(root)) return []

  const sets: FixtureSetInfo[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(root, entry.name, 'set.json')
    if (!existsSync(file)) continue
    try {
      const raw: unknown = JSON.parse(readFileSync(file, 'utf-8'))
      if (typeof raw !== 'object' || raw === null) continue
      sets.push(withDefaults(entry.name, raw as Record<string, unknown>))
    } catch {
      continue
    }
  }
  // Label, then name as the tie-break — two sets sharing a label would
  // otherwise swap places between reads.
  return sets.sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name))
}

/**
 * Which set a site serves.
 *
 * A site's name is its delivery-key namespace, and for the sets shipped with the
 * repository the two are the same string — so a site called `anyafinn` serves
 * the `anyafinn` set without anything being configured. The partner path breaks
 * that symmetry on purpose: `frontend-starter` content seeded under `acme/` is a
 * site named `acme` with no set of its own, and the hub says which set its sites
 * carry. Hence the order below.
 *
 * Returns `undefined` only when there are no sets on disk at all, which is a
 * broken checkout rather than a state to design around.
 */
export function resolveFixtureSet(
  siteName: string | undefined,
  hubDefault: string | undefined,
  sets: readonly FixtureSetInfo[],
): FixtureSetInfo | undefined {
  const find = (candidate: string | undefined) => {
    const name = (candidate ?? '').trim()
    return name === '' ? undefined : sets.find((s) => s.name === name)
  }
  return find(siteName) ?? find(hubDefault) ?? find(DEFAULT_FIXTURE_SET) ?? sets[0]
}
