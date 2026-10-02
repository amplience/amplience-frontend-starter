/**
 * resolveContentConfig — the one place environment becomes content-client
 * configuration (QL-43; ADR-0003 note).
 *
 * The contract: no configuration means the mock, so a fresh clone runs the
 * fixture site offline with zero setup; setting AMPLIENCE_HUB_NAME points
 * the same app at a real hub via the SDK. CONTENT_CLIENT can still be set
 * explicitly to force a specific client (e.g. CONTENT_CLIENT=mock alongside
 * a hub name to use fixture data for debugging). Everything an operator sets
 * is flat env vars today; when ADR-0003 lands its per-owner hub catalogue
 * (alias file + one selector variable), the lookup changes inside this
 * function and nowhere else.
 *
 * Variables read:
 *
 *   AMPLIENCE_HUB_NAME       set → sdk; unset → mock (the zero-config default)
 *   CONTENT_CLIENT           optional override: 'mock' | 'sdk'; wins over
 *                            hub-name inference when present
 *   SITE_NAME                sdk mode only: the deployment's delivery-key
 *                            namespace (ADR-0014) — every key is
 *                            `<site>/<relative>`. Optional: defaults to the
 *                            fixture set's name (ADR-0019), the same default
 *                            hub-import seeds under, so a hub carrying one
 *                            set and its deployment agree without either
 *                            setting it. Set it for a site whose namespace
 *                            isn't a set's name (a partner's own name, or a
 *                            second site on one hub). Ignored by the mock,
 *                            which has no re-prefixing step to honour it.
 *                            Lowercase alphanumerics and hyphens.
 *   FIXTURE_SET              which fixture set (ADR-0019). Mock mode: the set
 *                            served, and so the site name. Sdk mode: the
 *                            default for SITE_NAME, mirroring hub-import's
 *                            `SITE_NAME ?? FIXTURE_SET ?? 'frontend-starter'`.
 *                            Defaults to 'frontend-starter'.
 *   AMPLIENCE_STAGING_HOST   optional VSE host; serves latest saved versions
 *   AMPLIENCE_LOCALE         optional locale passed to the delivery API
 *
 * Hub names and staging hosts are not secrets, but they identify the
 * organisations a deployment serves — keep them in deployment env and
 * per-owner config, not in the public repo (ADR-0003 note).
 *
 * Misconfiguration throws a plain Error at composition time: like registry
 * composition (ADR-0010), a config bug should be loud at boot, not a
 * renderer failure card at request time. A boot log line names the chosen
 * client so a silent misconfiguration (typo in a var name) is diagnosable
 * from server logs.
 */

export type ContentClientSelection =
  | { readonly kind: 'mock'; readonly siteName: string }
  | {
      readonly kind: 'sdk'
      readonly hubName: string
      readonly siteName: string
      readonly stagingHost?: string
      readonly locale?: string
    }

/**
 * The fixture set used when `FIXTURE_SET` isn't given — the set a zero-config
 * mock serves, and the namespace a zero-config hub deployment reads, because
 * that's where a zero-config `hub:import` seeds it (ADR-0019). For fixtures the
 * set name, the site name and the delivery-key prefix are one string.
 *
 * Declared here rather than in the set registry so that config stays
 * dependency-free: the registry imports this, not the other way round, because
 * importing the registry here would pull every fixture in every set into the
 * bundle of any deployment that merely reads config — including sdk-mode ones
 * that never touch a fixture. The registry validates the name when the mock is
 * composed, and throws naming the sets it does have.
 */
export const FIXTURE_SITE_NAME = 'frontend-starter'

/**
 * The shape a site name must have (ADR-0014): lowercase alphanumerics and
 * single hyphens. It's the literal first segment of every delivery key on
 * the hub, so it's validated once here, at composition time — never matched
 * as a pattern at request time.
 */
const SITE_NAME_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const validateSiteName = (siteName: string, source: string): string => {
  if (!SITE_NAME_SHAPE.test(siteName)) {
    throw new Error(
      `${source} "${siteName}" is not a usable site name — lowercase letters, ` +
        'digits, and single hyphens only (e.g. "acme" or "acme-store"). It is ' +
        'the first segment of every delivery key on the hub (ADR-0014). ' +
        'Set SITE_NAME (with a hub) or FIXTURE_SET (offline) to choose one.',
    )
  }
  return siteName
}

type EnvSource = Record<string, string | undefined>

const present = (value: string | undefined): value is string => value !== undefined && value !== ''

// `process` via globalThis rather than node types: this package compiles
// without a Node ambient context (it also runs under edge/test runtimes),
// and an absent `process` just means "no configuration" — the mock.
const processEnv: EnvSource = (globalThis as { process?: { env?: EnvSource } }).process?.env ?? {}

export const resolveContentConfig = (env: EnvSource = processEnv): ContentClientSelection => {
  // Hub name present → sdk, absent → mock. An explicit CONTENT_CLIENT wins.
  const hubName = env.AMPLIENCE_HUB_NAME
  const inferred = present(hubName) ? 'sdk' : 'mock'
  const selected = present(env.CONTENT_CLIENT) ? env.CONTENT_CLIENT : inferred

  // The set in play, and the namespace default that follows from it — the same
  // `FIXTURE_SET ?? 'frontend-starter'` hub-import resolves (ADR-0019).
  const fixtureSet = present(env.FIXTURE_SET)
    ? validateSiteName(env.FIXTURE_SET, 'FIXTURE_SET')
    : FIXTURE_SITE_NAME

  if (selected === 'mock') {
    // The mock's site name *is* its set's name (ADR-0019). SITE_NAME is not
    // read here: the mock has no re-prefixing step, so honouring a partner
    // namespace offline would address keys no fixture carries. An unknown set
    // throws when the mock is composed, naming the sets that do exist.
    return { kind: 'mock', siteName: fixtureSet }
  }

  if (selected !== 'sdk') {
    throw new Error(
      `CONTENT_CLIENT="${selected}" is not a content client — expected "mock" or "sdk".`,
    )
  }

  if (!present(hubName)) {
    throw new Error(
      'CONTENT_CLIENT=sdk needs AMPLIENCE_HUB_NAME — the hub name in ' +
        '<hubName>.cdn.content.amplience.net. Unset CONTENT_CLIENT to use the mock.',
    )
  }

  // The site name defaults to the fixture set's name (ADR-0019, amending
  // ADR-0014's hub-name default): hub-import seeds under exactly this default,
  // so a hub carrying one set and its deployment agree without either setting
  // SITE_NAME — and a mismatch is loud anyway: every page 404s. An explicit
  // SITE_NAME wins, for a namespace that isn't a set's name.
  const siteName = present(env.SITE_NAME)
    ? validateSiteName(env.SITE_NAME, 'SITE_NAME')
    : fixtureSet

  return {
    kind: 'sdk',
    hubName,
    siteName,
    ...(present(env.AMPLIENCE_STAGING_HOST) && { stagingHost: env.AMPLIENCE_STAGING_HOST }),
    ...(present(env.AMPLIENCE_LOCALE) && { locale: env.AMPLIENCE_LOCALE }),
  }
}
