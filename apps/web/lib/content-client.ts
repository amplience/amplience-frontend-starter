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
 *
 * `client` is request-aware (ADR-0028): inside a schedule preview it reads
 * through the preview's staging host, otherwise through `liveClient`. Routes
 * keep importing `client` and never need to know which.
 */

import { cache } from 'react'

import { resolveContentConfig } from '@amplience/frontend-starter-content'
import type { ContentClient, ContentRequestOptions } from '@amplience/frontend-starter-content'
import { fixtureSetNames, makeMockContentClient } from '@amplience/frontend-starter-content/mock'
import { makeSdkContentClient } from '@amplience/frontend-starter-content/sdk'

import { loadLocalFixtureSet } from './local-fixture-set'
import { getPreviewHost } from './preview-request'

const config = resolveContentConfig()

// In mock mode the site name *is* the fixture set (ADR-0019) — FIXTURE_SET —
// so one value selects both the content and the namespace it's addressed under.
// A name the registry lacks may be a gitignored local set; failing that, the
// registry throws naming what it has.
const mockSet = (name: string) =>
  fixtureSetNames().includes(name) ? name : (loadLocalFixtureSet(name) ?? name)

/**
 * The published site, regardless of request. For reads that are shared
 * across requests (`unstable_cache`), which must never see preview content.
 */
export const liveClient: ContentClient =
  config.kind === 'sdk'
    ? makeSdkContentClient(config)
    : makeMockContentClient(mockSet(config.siteName))

/** A client pinned to one staging host; the hub name is cosmetic once it's set. */
const previewClient = cache((host: string): ContentClient =>
  makeSdkContentClient({
    hubName: config.kind === 'sdk' ? config.hubName : 'preview',
    stagingHost: host,
    ...(config.kind === 'sdk' && config.locale !== undefined && { locale: config.locale }),
  }),
)

const active = async (): Promise<ContentClient> => {
  const host = await getPreviewHost()
  return host === undefined ? liveClient : previewClient(host)
}

/** The client every route reads through — live, or the request's preview. */
export const client: ContentClient = {
  getByKey: async <T>(key: string, opts?: ContentRequestOptions) =>
    (await active()).getByKey<T>(key, opts),
  getById: async <T>(id: string, opts?: ContentRequestOptions) =>
    (await active()).getById<T>(id, opts),
  listBySchema: async <T>(schemaId: string, opts?: Pick<ContentRequestOptions, 'locale'>) =>
    (await active()).listBySchema<T>(schemaId, opts),
  getHierarchy: async <T>(rootKey: string) => (await active()).getHierarchy<T>(rootKey),
}

/**
 * The deployment's site name (ADR-0014) — the namespace prefix on every
 * delivery key this deployment reads. Resolved by the same single
 * env-reading function as the client selection, exported here so routes
 * and layouts share one value.
 */
export const siteName: string = config.siteName
