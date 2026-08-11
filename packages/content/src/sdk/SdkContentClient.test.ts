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

const schemaOf = (body: unknown): string | undefined =>
  (body as { _meta?: { schema?: string } })._meta?.schema

type HierarchyMeta = { _meta?: { hierarchy?: { parentId?: string; position?: string } } }

const positionOf = (f: { body: unknown }): string =>
  (f.body as HierarchyMeta)._meta?.hierarchy?.position ?? ''

/**
 * Every fixture that sits inside a hierarchy below a root node, ordered by the
 * `trait:sortable` position string. The adapter asks for `sortKey: 'default'`,
 * which is what CD2 sorts by, so the fake has to sort the same way or the
 * order it returns would be an artefact of fixture-load order.
 */
const hierarchyDescendants = () =>
  allFixtures()
    .filter((f) => (f.body as HierarchyMeta)._meta?.hierarchy?.parentId !== undefined)
    .sort((a, b) => {
      // Code-unit order, not localeCompare: the position strings are a
      // fractional index over raw characters, and ICU collation reorders
      // 'O' against 'g' — which would silently reverse the menu.
      const [x, y] = [positionOf(a), positionOf(b)]
      if (x < y) return -1
      return x > y ? 1 : 0
    })

/**
 * A fake CD2 backed by the fixture maps — the same data the mock client
 * serves, looked up and depth-resolved the same way. Routes the three
 * endpoints the adapter uses: `content/fetch` (get by key/id), `content/filter`
 * (listBySchema) and the hierarchy descendants GET (getHierarchy).
 */
const fixtureBackedAdaptor = (capture?: { configs: AxiosishConfig[] }) =>
  ((config: AxiosishConfig) => {
    capture?.configs.push(config)
    const url = config.url ?? ''

    // The hierarchy flow first GETs the root item on its own before asking for
    // descendants, so that single-item endpoint needs serving too.
    if (url.startsWith('content/key/') || url.startsWith('content/id/')) {
      const [, kind, ...rest] = url.split('?')[0]?.split('/') ?? []
      const ref = rest.join('/')
      const item = kind === 'key' ? findByKey(ref) : findById(ref)
      if (!item) return Promise.reject(new Error(`no fixture for ${url}`))
      return Promise.resolve(okResponse(config, { content: item.body }))
    }

    // Hierarchy descendants is a GET; the SDK's assembler picks the subtree it
    // wants out of the flat list by `_meta.hierarchy.parentId`, exactly as CD2
    // returns it.
    if (url.includes('/content/hierarchies/descendants/')) {
      return Promise.resolve(
        okResponse(config, {
          responses: hierarchyDescendants().map((f) => ({ content: f.body })),
          page: {},
        }),
      )
    }

    if (url.includes('content/filter')) {
      const body = parsePayload(config) as unknown as {
        filterBy?: { path: string; value: unknown }[]
      }
      const wanted = body.filterBy?.find((f) => f.path === '/_meta/schema')?.value
      return Promise.resolve(
        okResponse(config, {
          responses: allFixtures()
            .filter((f) => schemaOf(f.body) === wanted)
            .map((f) => ({ content: f.body })),
          page: {},
        }),
      )
    }

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

  it('omits locale when none is configured', async () => {
    const capture = { configs: [] as AxiosishConfig[] }
    await makeClient({}, capture).getByKey('base-site/homepage')
    expect(parsePayload(first(capture.configs)).parameters).not.toHaveProperty('locale')
  })

  it('forwards the configured deployment locale', async () => {
    const capture = { configs: [] as AxiosishConfig[] }
    await makeClient({ locale: 'en-GB,*' }, capture).getByKey('base-site/homepage')
    expect(parsePayload(first(capture.configs)).parameters?.locale).toBe('en-GB,*')
  })

  it('lets a per-request locale override the deployment default', async () => {
    const capture = { configs: [] as AxiosishConfig[] }
    await makeClient({ locale: 'en-GB,*' }, capture).getByKey('base-site/homepage', {
      locale: 'fr-FR,*',
    })
    expect(parsePayload(first(capture.configs)).parameters?.locale).toBe('fr-FR,*')
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

  it('maps a bare axios "Network Error" to network even with no error code', async () => {
    // Browsers and some proxies surface a failed request as an Error with that
    // exact message and nothing else to key off, so the message is the signal.
    const client = failingClient(() => Promise.reject(new Error('Network Error')))
    await expectKind(client.getByKey('homepage'), 'network')
  })

  it("maps the SDK's ContentNotFoundError to not-found", async () => {
    // The SDK throws this as a named error rather than an HTTP status when a
    // request resolves but the item is absent.
    const client = failingClient(() =>
      Promise.reject(Object.assign(new Error('not found'), { name: 'CONTENT_NOT_FOUND' })),
    )
    await expectKind(client.getByKey('homepage'), 'not-found')
  })

  it('maps an unclassifiable failure to unknown', async () => {
    // No name, no status, no code, not a network message — the catch-all.
    const client = failingClient(() => Promise.reject(new Error('something else went wrong')))
    await expectKind(client.getByKey('homepage'), 'unknown')
  })

  it('maps a non-object rejection to unknown without throwing on it', async () => {
    // A thrown string has no properties to read; the error-shape sniff has to
    // tolerate that rather than blowing up inside the error handler. Rejecting
    // with a non-Error is the whole point of the case, hence the disable.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const client = failingClient(() => Promise.reject('kaboom'))
    await expectKind(client.getByKey('homepage'), 'unknown')
  })

  it('maps a non-object response body to malformed', async () => {
    // A proxy or captive portal can answer 200 with an HTML string body.
    const client = failingClient((config) => Promise.resolve(okResponse(config, 'not json')))
    await expectKind(client.getByKey('homepage'), 'malformed')
  })

  it('maps an unrecognisable response shape to malformed', async () => {
    const client = failingClient((config) =>
      Promise.resolve(okResponse(config, { unexpected: true })),
    )
    await expectKind(client.getByKey('homepage'), 'malformed')
  })
})

describe('listBySchema', () => {
  it('returns the same items as the mock for a schema in the fixture set', async () => {
    // The parity claim extends to the Filter API, not just content/fetch.
    const sdk = makeClient()
    const mock = makeMockContentClient()
    const schema = 'https://quadratic.amplience.com/v2/content/page'
    await expect(sdk.listBySchema(schema)).resolves.toEqual(await mock.listBySchema(schema))
  })

  it('returns [] for a schema no content uses', async () => {
    await expect(makeClient().listBySchema('https://example.com/nope')).resolves.toEqual([])
  })

  it('asks for root depth and inlined format, and omits locale when none is set', async () => {
    // depth: 'root' keeps list responses small — a lister renders cards, not
    // whole component trees.
    const capture = { configs: [] as AxiosishConfig[] }
    await makeClient({}, capture).listBySchema('https://quadratic.amplience.com/v2/content/page')
    const params = parsePayload(first(capture.configs)).parameters
    expect(params?.depth).toBe('root')
    expect(params?.format).toBe('inlined')
    expect(params?.locale).toBeUndefined()
  })

  it('forwards the deployment locale, and lets a per-request locale override it', async () => {
    const schema = 'https://quadratic.amplience.com/v2/content/page'

    const configured = { configs: [] as AxiosishConfig[] }
    await makeClient({ locale: 'en-GB,*' }, configured).listBySchema(schema)
    expect(parsePayload(first(configured.configs)).parameters?.locale).toBe('en-GB,*')

    const overridden = { configs: [] as AxiosishConfig[] }
    await makeClient({ locale: 'en-GB,*' }, overridden).listBySchema(schema, { locale: 'fr-FR,*' })
    expect(parsePayload(first(overridden.configs)).parameters?.locale).toBe('fr-FR,*')
  })
})

describe('getHierarchy', () => {
  it('assembles the same tree as the mock', async () => {
    // Both implementations flatten the SDK/manifest tree into the `items` +
    // `children` shape the HierarchyMenu registry entries read.
    const key = 'base-site/site/hierarchy-menu-main'
    const fromSdk = await makeClient().getHierarchy<Record<string, unknown>>(key)
    const fromMock = await makeMockContentClient().getHierarchy<Record<string, unknown>>(key)

    // Parity holds everywhere except the root's `_meta.deliveryKeys` — see the
    // test below for why that one key differs.
    const { deliveryKeys: _dropped, ...mockMeta } = fromMock._meta as Record<string, unknown>
    expect(fromSdk).toEqual({ ...fromMock, _meta: mockMeta })
  })

  it('loses the root item’s deliveryKeys — a known SDK mapping gap, not ours', async () => {
    // dc-delivery-sdk-js maps the hierarchy root through its own ContentItem
    // class, whose ContentMeta predates multi-delivery-keys, so `toJSON()`
    // drops `_meta.deliveryKeys` (descendants, which never go through that
    // class, keep theirs). Nothing reads delivery keys off a menu root today,
    // so this is pinned rather than worked around — if a future registry entry
    // needs them on a hierarchy root, this test says where they went.
    const key = 'base-site/site/hierarchy-menu-main'
    const fromSdk = await makeClient().getHierarchy<Record<string, unknown>>(key)
    const fromMock = await makeMockContentClient().getHierarchy<Record<string, unknown>>(key)

    expect(fromMock._meta).toHaveProperty('deliveryKeys')
    expect(fromSdk._meta).not.toHaveProperty('deliveryKeys')
    // Everything else identifying the root still survives the round trip.
    expect(fromSdk._meta).toMatchObject({
      schema: 'https://quadratic.amplience.com/v2/content/hierarchy-menu',
      deliveryId: 'c3d4e5f6-0004-4000-8000-000000000001',
    })
  })

  it('nests the root under `items` and descendants under `children`', async () => {
    const menu = await makeClient().getHierarchy<{
      items: { children?: unknown[] }[]
    }>('base-site/site/hierarchy-menu-main')
    expect('children' in menu).toBe(false)
    expect(menu.items.length).toBeGreaterThan(0)
    expect(menu.items.some((i) => Array.isArray(i.children))).toBe(true)
    // Leaves carry no `children` key at all, so a leaf renders as a plain link.
    expect(menu.items.some((i) => !('children' in i))).toBe(true)
  })
})
