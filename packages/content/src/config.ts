/**
 * resolveContentConfig — the one place environment becomes content-client
 * configuration (QL-43; ADR-0003 note).
 *
 * The contract: no configuration means the mock, so a fresh clone runs the
 * fixture site offline with zero setup; `CONTENT_CLIENT=sdk` plus a hub
 * name points the same app at a real hub. Everything an operator sets is
 * flat env vars today; when ADR-0003 lands its per-owner hub catalogue
 * (alias file + one selector variable), the lookup changes inside this
 * function and nowhere else.
 *
 * Variables read:
 *
 *   CONTENT_CLIENT           'mock' (default) | 'sdk'
 *   AMPLIENCE_HUB_NAME       required for 'sdk' — public-endpoint hub name
 *   AMPLIENCE_STAGING_HOST   optional VSE host; serves latest saved versions
 *   AMPLIENCE_LOCALE         optional locale passed to the delivery API
 *
 * Hub names and staging hosts are not secrets, but they identify the
 * organisations a deployment serves — keep them in deployment env and
 * per-owner config, not in the public repo (ADR-0003 note).
 *
 * Misconfiguration throws a plain Error at composition time: like registry
 * composition (ADR-0010), a config bug should be loud at boot, not a
 * renderer failure card at request time.
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
  const selected = present(env.CONTENT_CLIENT) ? env.CONTENT_CLIENT : 'mock'

  if (selected === 'mock') return { kind: 'mock' }

  if (selected !== 'sdk') {
    throw new Error(
      `CONTENT_CLIENT="${selected}" is not a content client — expected "mock" or "sdk".`,
    )
  }

  const hubName = env.AMPLIENCE_HUB_NAME
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
