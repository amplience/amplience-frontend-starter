/**
 * The deployment's content client (QL-43) — composed once, here.
 *
 * `resolveContentConfig` turns the environment into a selection (no config
 * → mock, so a fresh clone runs the fixture site offline); this module
 * turns the selection into the client every route shares. The two concerns
 * stay separate on purpose: resolution is the content package's single
 * env-reading function (ADR-0003 note — the future per-owner hub catalogue
 * lands inside it), while choosing and constructing an implementation is
 * the deployment's composition act, like the registry (ADR-0010).
 *
 * Module-level construction is deliberate and matches the registry: both
 * clients are stateless over immutable config, and a misconfiguration
 * (e.g. CONTENT_CLIENT=sdk with no hub name) throws at boot — loud at
 * composition time, not a failure card at request time.
 */

import { resolveContentConfig } from '@amplience/quadratic-content'
import type { ContentClient } from '@amplience/quadratic-content'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'
import { makeSdkContentClient } from '@amplience/quadratic-content/sdk'

const config = resolveContentConfig()

export const client: ContentClient =
  config.kind === 'sdk' ? makeSdkContentClient(config) : makeMockContentClient()

/**
 * The deployment's site name (ADR-0014) — the namespace prefix on every
 * delivery key this deployment reads. Resolved by the same single
 * env-reading function as the client selection, exported here so routes
 * and layouts share one value.
 */
export const siteName: string = config.siteName
