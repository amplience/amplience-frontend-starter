/**
 * SdkContentClient tests (QL-43).
 *
 * No network: the SDK accepts a custom axios adapter, so these tests stand
 * up a fake CD2 `content/fetch` endpoint served from the same fixtures the
 * mock client reads. That makes the central claim checkable directly —
 * *the SDK adapter and the mock are interchangeable implementations of the
 * port*: for every fixture, both clients return deep-equal bodies at both
 * depths. The fake honours `depth` the way CD2 does (root → stubs, all →
 * inlined via the same resolver semantics), and the error suite drives the
 * adapter's mapping from SDK/transport failures onto ContentClientError
 * kinds.
 */

import { describe, expect, it } from 'vitest'

import { allFixtures, findById, findByKey, makeMockContentClient } from '../mock'
import { resolveDeep } from '../mock/resolver'
import type { ContentRequestOptions } from '../types'
import { isContentClientError } from '../types'
import { makeSdkContentClient } from './SdkContentClient'
import type { SdkContentClientConfig } from './SdkContentClient'

type FetchPayload = {
  requests: ({ key: string } | { id: string })[]
  parameters?: { depth?: 'root' | 'all'; format?: string; locale?: string }
}

type AxiosishConfig = { url?: string; baseURL?: string; data?: unknown }

/** Parse the request body the way an axios adapter receives it (JSON string). */
const parsePayload = (config: AxiosishConfig): FetchPayload =>
  (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) as FetchPayload

const okResponse = (config: AxiosishConfig, data: unknown) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

/**
 * A fake CD2 `content/fetch` backed by the fixture maps — the same data the
 * mock client serves, looked up and depth-resolved the same way.
 */
const fixtureBackedAdaptor = (capture?: { configs: AxiosishConfig[] }) =>
  ((config: AxiosishConfig) => {
    capture?.configs.push(config)
    const payload = parsePayload(config)
    const depth = payload.parameters?.depth ?? 'all'
    const responses = payload.requests.map((request) => {
      const item = 'key' in request ? findByKey(request.key) : findById(request.id)
      if (!item) return { error: { type: 'CONTENT_NOT_FOUND' } }
      const body = depth === 'all' ? resolveDeep(item.body, findById) : item.body
      return { content: body }
    })
    return Promise.resolve(okResponse(config, { responses }))
    // The SDK types `adaptor` against axios internals; the fake only needs
    // the parts the SDK touches.
  }) as unknown as NonNullable<SdkContentClientConfig['adaptor']>

const makeClient = (
  overrides: Partial<SdkContentClientConfig> = {},
  capture?: { configs: AxiosishConfig[] },
) =>
  makeSdkContentClient({
    hubName: 'fixturehub',
    adaptor: fixtureBackedAdaptor(capture),
    ...overrides,
  })

/** First element, asserted present — for strict indexed access in tests. */
const first = <T>(items: readonly T[]): T => {
  const [head] = items
  if (head === undefined) throw new Error('expected at least one element')
  return head
}

/** First delivery key of a fixture body, if it has one. */
const firstKey = (body: unknown): string | undefined =>
  (body as { _meta?: { deliveryKeys?: { values?: { value: string }[] } } })._meta?.deliveryKeys
    ?.values?.[0]?.value

describe('SdkContentClient ↔ MockContentClient parity', () => {
  const sdk = makeClient()
  const mock = makeMockContentClient()
  const depths: ContentRequestOptions[] = [{ depth: 'root' }, { depth: 'all' }]

  for (const fixture of allFixtures()) {
    const key = firstKey(fixture.body)
    if (key === undefined) continue
    for (const opts of depths) {
      it(`getByKey("${key}", ${opts.depth}) matches the mock`, async () => {
        await expect(sdk.getByKey(key, opts)).resolves.toEqual(await mock.getByKey(key, opts))
      })
    }
  }

  it('getById matches the mock at both depths', async () => {
    const fixture = first(allFixtures())
    for (const opts of depths) {
      await expect(sdk.getById(fixture.id, opts)).resolves.toEqual(
        await mock.getById(fixture.id, opts),
      )
    }
  })
})

describe('request shaping', () => {
  it('defaults depth to root and always asks for inlined format', async () => {
    const capture = { configs: [] as AxiosishConfig[] }
    const client = makeClient({}, capture)
    await client.getByKey('base-site/homepage')
    const payload = parsePayload(first(capture.configs))
    expect(payload.parameters).toMatchObject({ depth: 'root', format: 'inlined' })
    expect(payload.requests).toEqual([{ key: 'base-site/homepage' }])
  })

  it('targets the hub CDN host by default and the VSE when stagingHost is set', async () => {
    const cdnCapture = { configs: [] as AxiosishConfig[] }
    await makeClient({}, cdnCapture).getByKey('base-site/homepage')
    expect(first(cdnCapture.configs).baseURL).toContain('fixturehub')

    const vseCapture = { configs: [] as AxiosishConfig[] }
    await makeClient({ stagingHost: 'abc.staging.bigcontent.io' }, vseCapture).getByKey(
      'base-site/homepage',
    )
    expect(first(vseCapture.configs).baseURL).toContain('abc.staging.bigcontent.io')
  })
})

describe('error mapping', () => {
  const failingClient = (
    behaviour: (config: AxiosishConfig) => Promise<unknown>,
  ): ReturnType<typeof makeSdkContentClient> =>
    makeSdkContentClient({
      hubName: 'fixturehub',
      adaptor: behaviour as unknown as NonNullable<SdkContentClientConfig['adaptor']>,
    })

  const expectKind = async (promise: Promise<unknown>, kind: string) => {
    const error = await promise.then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(isContentClientError(error), `expected a ContentClientError, got ${String(error)}`).toBe(
      true,
    )
    expect((error as { kind: string }).kind).toBe(kind)
  }

  it('maps a per-item error entry to not-found (getByKey and getById)', async () => {
    const client = makeClient()
    await expectKind(client.getByKey('no-such-key'), 'not-found')
    await expectKind(client.getById('00000000-0000-4000-8000-000000000000'), 'not-found')
  })

  it('maps 401/403 to unauthorised', async () => {
    for (const status of [401, 403]) {
      const client = failingClient((config) =>
        Promise.reject(
          Object.assign(new Error(`HTTP ${status}`), { config, response: { status, data: {} } }),
        ),
      )
      await expectKind(client.getByKey('homepage'), 'unauthorised')
    }
  })

  it('maps an endpoint-level 404 to not-found', async () => {
    const client = failingClient((config) =>
      Promise.reject(
        Object.assign(new Error('HTTP 404'), { config, response: { status: 404, data: {} } }),
      ),
    )
    await expectKind(client.getByKey('homepage'), 'not-found')
  })

  it('maps other HTTP failures to unknown', async () => {
    const client = failingClient((config) =>
      Promise.reject(
        Object.assign(new Error('HTTP 500'), { config, response: { status: 500, data: {} } }),
      ),
    )
    await expectKind(client.getByKey('homepage'), 'unknown')
  })

  it('maps transport failures (no response) to network', async () => {
    const client = failingClient(() =>
      Promise.reject(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })),
    )
    await expectKind(client.getByKey('homepage'), 'network')
  })

  it('maps an unrecognisable response shape to malformed', async () => {
    const client = failingClient((config) =>
      Promise.resolve(okResponse(config, { unexpected: true })),
    )
    await expectKind(client.getByKey('homepage'), 'malformed')
  })
})
