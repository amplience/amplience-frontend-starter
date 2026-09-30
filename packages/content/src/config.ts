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
 *   SITE_NAME                the deployment's delivery-key namespace
 *                            (ADR-0014) — every key is `<site>/<relative>`.
 *                            Optional: in sdk mode it defaults to the hub
 *                            name (hub-import seeds under the same default,
 *                            so the two stay in sync without a second
 *                            variable); in mock mode it defaults to the
 *                            fixture site's name ('frontend-starter'), because
 *                            running the mock *is* running that site — the
 *                            zero-config contract above extends to it. Set
 *                            it explicitly when the site isn't named after
 *                            the hub (e.g. a second site on one hub).
 *                            Lowercase alphanumerics and hyphens.
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
 * The fixture set a zero-config (mock) deployment serves, and therefore the
 * site name it resolves to. For fixtures the set name, the site name and the
 * delivery-key prefix are one string (ADR-0019), so `SITE_NAME` chooses the
 * set — there is no second variable.
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
        'Set SITE_NAME explicitly to choose one.',
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

  if (selected === 'mock') {
    // SITE_NAME picks the fixture set (set name = site name, ADR-0019); absent
    // one, the mock serves the default set. An unknown set throws when the mock
    // is composed, naming the sets that do exist.
    const siteName = present(env.SITE_NAME)
      ? validateSiteName(env.SITE_NAME, 'SITE_NAME')
      : FIXTURE_SITE_NAME
    return { kind: 'mock', siteName }
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

  // The site name defaults to the hub name: hub-import seeds keys under the
  // same default, so a hub and its deployment agree without either setting
  // SITE_NAME. This is deployment-specific config the operator chose, not a
  // guessed constant (contrast v1's fixed fallback brand) — and a mismatch
  // is loud anyway: every page 404s. An explicit SITE_NAME wins, for sites
  // not named after their hub.
  const siteName = present(env.SITE_NAME)
    ? validateSiteName(env.SITE_NAME, 'SITE_NAME')
    : validateSiteName(hubName, 'AMPLIENCE_HUB_NAME (the SITE_NAME default)')

  return {
    kind: 'sdk',
    hubName,
    siteName,
    ...(present(env.AMPLIENCE_STAGING_HOST) && { stagingHost: env.AMPLIENCE_STAGING_HOST }),
    ...(present(env.AMPLIENCE_LOCALE) && { locale: env.AMPLIENCE_LOCALE }),
  }
}
