/**
 * What "active" means, now that it can be one of several fixture sets.
 *
 * `config.active` used to be either a hub's name or the literal `fixtures`.
 * With more than one set on disk that sentinel can no longer say which content
 * the app is running against, so it is replaced by the set's own name — and a
 * set name is distinguishable from a hub name because the hubs are enumerable.
 *
 * Everything here is pure, so the rules that decide which content source is
 * live, and what gets written to the env files for it, are testable without a
 * filesystem or a running server.
 */

import { resolveFixtureSet, type FixtureSetInfo } from './fixture-sets.ts'

/** The pre-set-aware sentinel. Still accepted, always migrated away from. */
export const LEGACY_FIXTURES_NAME = 'fixtures'

/** The fields of an environment this module needs. Structural, like EnvSource. */
export type ActiveSourceEnv = {
  name: string
  hubName: string
  defaultSite: string
  defaultBrand: string
  /** Which set this hub's sites carry when their names don't say (partner path). */
  defaultFixtureSet?: string
}

/** The resolved identity of whatever is currently active. */
export type ActiveSource =
  | { kind: 'hub'; env: ActiveSourceEnv; set: FixtureSetInfo | undefined }
  | { kind: 'set'; set: FixtureSetInfo }
  | { kind: 'none' }

/**
 * Migrate a config read from disk.
 *
 * Only one migration so far: the `fixtures` sentinel becomes the name of the set
 * it used to mean. It runs on every read rather than once, because the file is
 * hand-editable and a checkout can predate any given change — and it is a no-op
 * on an already-migrated config, so re-running costs nothing.
 *
 * `defaultSite` is deliberately left alone. It reads like a hub-level default
 * but is in fact the `Web (localhost)` row's own namespace field, sitting
 * alongside `localhostUrl` and `defaultBrand`; the deployed sites in `webApps[]`
 * each carry their own. Retiring it would take the partner path with it.
 */
export function migrateActive(active: string, sets: readonly FixtureSetInfo[]): string {
  if (active !== LEGACY_FIXTURES_NAME) return active
  return resolveFixtureSet(undefined, undefined, sets)?.name ?? active
}

/**
 * Resolve the active name against the hubs and the sets.
 *
 * A hub wins over a set of the same name: hubs are user-named and a collision
 * would otherwise take their hub away from them. `none` means the name matches
 * neither, which happens to a config naming a hub that has since been deleted.
 */
export function resolveActiveSource(
  active: string,
  environments: readonly ActiveSourceEnv[],
  sets: readonly FixtureSetInfo[],
): ActiveSource {
  const env = environments.find((e) => e.name === active)
  if (env !== undefined) {
    return {
      kind: 'hub',
      env,
      set: resolveFixtureSet(env.defaultSite, env.defaultFixtureSet, sets),
    }
  }
  const name = migrateActive(active, sets)
  const set = sets.find((s) => s.name === name)
  return set === undefined ? { kind: 'none' } : { kind: 'set', set }
}

/**
 * The namespace a hub's `Web (localhost)` row uses, and the fallback for any
 * site added to the hub with its site name left blank.
 *
 * `defaultSite` when it's set; otherwise the name of the set this hub's sites
 * carry (`defaultFixtureSet`, else the default set) — the same
 * `SITE_NAME ?? FIXTURE_SET ?? 'frontend-starter'` that hub-import and the web
 * app's `resolveContentConfig` both apply (ADR-0019, amending ADR-0014's
 * hub-name default). Resolved here rather than left blank so every site record
 * and every deployment's env vars say what they mean.
 */
export function defaultSiteName(
  env: Pick<ActiveSourceEnv, 'hubName' | 'defaultSite' | 'defaultFixtureSet'>,
  sets: readonly FixtureSetInfo[],
): string {
  const explicit = env.defaultSite.trim()
  if (explicit !== '') return explicit
  // Only an empty checkout has no sets; the hub name is then the least-bad guess.
  return resolveFixtureSet(undefined, env.defaultFixtureSet, sets)?.name ?? env.hubName
}

/**
 * The namespace a given set's content belongs in, on a given hub.
 *
 * An operation that names a set is asking for that set specifically, so it can't
 * take the namespace from the hub's localhost row — on a hub carrying two sets
 * that row describes one of them, and seeding the other into its namespace is
 * the 409 this whole mechanism exists to stop.
 *
 * But the set's own name isn't the answer either: the partner path is
 * `frontend-starter` content under `acme/`, and making `--set` override
 * `SITE_NAME` would conflate which content with which namespace and remove that
 * path entirely. So the question asked here is "which of this hub's sites serves
 * that set" — the localhost row and each deployed site, resolved the same way
 * they are everywhere else. Only when no site claims the set does it fall back
 * to the set's own name, which is what a bare `--set` on the CLI does too.
 */
export function namespaceForSet(
  setName: string,
  env: ActiveSourceEnv,
  siteNames: readonly string[],
  sets: readonly FixtureSetInfo[],
): string {
  const localhost = defaultSiteName(env, sets)
  const candidates = [localhost, ...siteNames].map((s) => s.trim()).filter((s) => s !== '')
  const serving = candidates.find(
    (name) => resolveFixtureSet(name, env.defaultFixtureSet, sets)?.name === setName,
  )
  return serving ?? setName
}

/**
 * The site identity the env files describe: which namespace, which set's
 * content, which brand, what the pages are titled.
 *
 * These four travel together on purpose. `SITE_NAME` and `FIXTURE_SET` drifting
 * apart is the failure this is built to prevent — a stale namespace silently
 * re-targeting a seed, so the import writes `frontend-starter/…` while the app
 * reads `anyafinn/…` and every page 404s with nothing in either file looking
 * wrong. Deriving all four in one place means nothing can set one without the
 * rest.
 */
export type SiteIdentity = {
  siteName: string
  fixtureSet: string | undefined
  brand: string
  title: string | undefined
}

/**
 * Brand precedence is site → set → unset (the app's own `default` theme).
 *
 * The set says what its content looks like as itself; a site can dress the same
 * content differently, and the editable knob lives on the site because that is
 * where the other per-deployment settings already are. A set added to the
 * repository therefore arrives with a working brand and needs no configuration.
 */
export function siteIdentity(source: ActiveSource): SiteIdentity | undefined {
  if (source.kind === 'none') return undefined

  if (source.kind === 'set') {
    const { set } = source
    // Offline, the set is the site: its name is the namespace the mock serves
    // under, so the delivery keys resolve the same way they would on a hub.
    return {
      siteName: set.name,
      fixtureSet: set.name,
      brand: set.defaultBrand,
      title: set.label,
    }
  }

  const { env, set } = source
  return {
    // Blank resolves to the set's name — the runtime's own default (ADR-0019),
    // written out so the .env files say what they mean.
    siteName: env.defaultSite.trim() !== '' ? env.defaultSite.trim() : (set?.name ?? env.hubName),
    fixtureSet: set?.name,
    brand: env.defaultBrand.trim() !== '' ? env.defaultBrand.trim() : (set?.defaultBrand ?? ''),
    // A hub's pages are titled by whatever the deployment sets; only a fixture
    // set brings a title of its own, because offline there is nothing else to ask.
    title: undefined,
  }
}
