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
 *                            fixture site's name ('base-site'), because
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
 * The fixture site's name — the `SITE_NAME` a zero-config (mock) deployment
 * resolves to, matching the `base-site/` prefix on every fixture delivery
 * key in `../../fixtures/base-site/`.
 */
export const FIXTURE_SITE_NAME = 'base-site'

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
    // An explicit SITE_NAME still applies (and still has to be well-formed);
    // absent one, the mock serves the fixture site under its own name.
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
