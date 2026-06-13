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
  | { readonly kind: 'mock' }
  | {
      readonly kind: 'sdk'
      readonly hubName: string
      readonly stagingHost?: string
      readonly locale?: string
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

  if (selected === 'mock') return { kind: 'mock' }

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

  return {
    kind: 'sdk',
    hubName,
    ...(present(env.AMPLIENCE_STAGING_HOST) && { stagingHost: env.AMPLIENCE_STAGING_HOST }),
    ...(present(env.AMPLIENCE_LOCALE) && { locale: env.AMPLIENCE_LOCALE }),
  }
}
