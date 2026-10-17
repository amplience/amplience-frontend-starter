import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cmsHubId,
  graphql,
  listenerSchemas,
  managementGet,
  organizationOf,
  PAGE_SIZE,
  PAT_ENV_VARS,
  personalAccessToken,
  readListeners,
  readRegistry,
  requiredEnv,
  shapeRegistry,
  versionFrom,
} from './workforce-api.mjs'

describe('cmsHubId', () => {
  // Derived, not allocated — which is why no environment needs a second id
  // configured alongside the Dynamic Content one.
  it('builds the opaque id Workforce addresses a hub by', () => {
    const id = cmsHubId('org_cv6BwQhSuDQJBONk', '6a7c803601ac4b1a73b30ebe')
    expect(Buffer.from(id, 'base64').toString('utf8')).toBe(
      'CMSHub:org_cv6BwQhSuDQJBONk/6a7c803601ac4b1a73b30ebe',
    )
  })
})

describe('requiredEnv', () => {
  it('returns a trimmed value', () => {
    expect(requiredEnv('AMPLIENCE_HUB_ID', 'x', { AMPLIENCE_HUB_ID: '  abc  ' })).toBe('abc')
  })

  it('names the variable and what it is for', () => {
    expect(() => requiredEnv('AMPLIENCE_HUB_ID', 'identify the hub', {})).toThrow(
      /AMPLIENCE_HUB_ID is not set.*identify the hub/s,
    )
  })

  it('treats whitespace as unset', () => {
    expect(() => requiredEnv('AMPLIENCE_HUB_ID', 'x', { AMPLIENCE_HUB_ID: '   ' })).toThrow()
  })
})

describe('personalAccessToken', () => {
  // The same order flows-cli resolves in, so anyone set up for one is set up
  // for the other.
  it('prefers AMPLIENCE_PAT, then falls back to FLOWS_CLI_TOKEN', () => {
    expect(PAT_ENV_VARS).toEqual(['AMPLIENCE_PAT', 'FLOWS_CLI_TOKEN'])
    expect(personalAccessToken({ AMPLIENCE_PAT: 'a', FLOWS_CLI_TOKEN: 'b' })).toBe('a')
    expect(personalAccessToken({ FLOWS_CLI_TOKEN: 'b' })).toBe('b')
  })

  it('says the hub credentials are not an option rather than just "missing"', () => {
    expect(() => personalAccessToken({})).toThrow(/does not accept the hub credentials/)
  })
})

describe('versionFrom', () => {
  it('prefers an explicit version field', () => {
    expect(versionFrom({ version: '2.2.0', label: 'Latest' })).toBe('2.2.0')
  })

  // quadraticlite's API has no `version` on a release, but the picker title
  // reads "(v2.2.0)" — so the label is where that number comes from.
  it('falls back to a label that is really a version', () => {
    expect(versionFrom({ label: '2.2.0' })).toBe('2.2.0')
    expect(versionFrom({ label: 'v2.2.0' })).toBe('2.2.0')
    expect(versionFrom({ label: '3' })).toBe('3')
  })

  // A handle built from "Latest" would match nothing on another hub and means
  // less than no version at all.
  it('ignores a label that is a name rather than a number', () => {
    expect(versionFrom({ label: 'Latest' })).toBeUndefined()
    expect(versionFrom({ label: 'release-2' })).toBeUndefined()
    expect(versionFrom({})).toBeUndefined()
    expect(versionFrom(undefined)).toBeUndefined()
  })
})

// ── The transport half ───────────────────────────────────────────────────────
//
// Everything above is pure. What follows exercises the round-trips with a
// stubbed `fetch`, because two of them have already shipped bugs that only a
// live hub revealed: `readListeners` silently truncating at the default page
// size (which would have made the seed create a second listener under the same
// label), and the registry read refusing a page size the API caps at 50.

/** One `fetch` response. */
const reply = (body: unknown, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
})

/** Replays the given responses in order, recording every call. */
function stubFetch(...replies: unknown[]) {
  const calls: { url: string; body: unknown }[] = []
  let i = 0
  const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
    calls.push({
      url,
      body: init?.body === undefined ? undefined : (JSON.parse(init.body) as unknown),
    })
    return Promise.resolve(replies[Math.min(i++, replies.length - 1)])
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, count: () => i }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('graphql', () => {
  it('posts the query with the token and returns `data`', async () => {
    const { calls } = stubFetch(reply({ data: { cmsHub: { id: 'x' } } }))
    const data = await graphql('pat', 'query {}', { a: 1 })
    expect(data).toEqual({ cmsHub: { id: 'x' } })
    expect(calls[0]?.body).toEqual({ query: 'query {}', variables: { a: 1 } })
  })

  // ⚠️ A rejected query comes back as HTTP 400 *with* the reason in `errors`,
  // so the body is read before the status — branching on the status first
  // throws away the only informative part.
  it('prefers the GraphQL error over the status code', async () => {
    stubFetch(
      reply({ errors: [{ message: 'first must not exceed 50' }] }, { ok: false, status: 400 }),
    )
    await expect(graphql('pat', 'query {}')).rejects.toThrow(/first must not exceed 50/)
  })

  it('falls back to the status when there is no error to read', async () => {
    stubFetch(reply(null, { ok: false, status: 502 }))
    await expect(graphql('pat', 'query {}')).rejects.toThrow(/HTTP 502/)
  })

  it('survives a body that is not JSON at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('nope')) }),
      ),
    )
    await expect(graphql('pat', 'query {}')).rejects.toThrow(/HTTP 500/)
  })
})

describe('managementGet', () => {
  it('returns the parsed body', async () => {
    stubFetch(reply({ organizationId: 'org_1' }))
    expect(await managementGet('mgmt', 'https://example.test/hub')).toEqual({
      organizationId: 'org_1',
    })
  })

  it('names the URL in the failure, so the caller knows which read broke', async () => {
    stubFetch(reply(null, { ok: false, status: 404 }))
    await expect(managementGet('mgmt', 'https://example.test/hub')).rejects.toThrow(
      /Management API 404: https:\/\/example\.test\/hub/,
    )
  })
})

describe('organizationOf', () => {
  // The Environment Manager writes it on activation, so the common path is
  // free — and it saves a Management API round-trip per command.
  it('takes the configured id without asking the API', async () => {
    const { count } = stubFetch(reply({}))
    expect(await organizationOf('mgmt', 'hub-1', { AMPLIENCE_ORGANIZATION_ID: ' org_env ' })).toBe(
      'org_env',
    )
    expect(count()).toBe(0)
  })

  it('reads it off the hub when nothing is configured', async () => {
    stubFetch(reply({ organizationId: 'org_api' }))
    expect(await organizationOf('mgmt', 'hub-1', {})).toBe('org_api')
  })

  it('treats a blank configured value as absent', async () => {
    stubFetch(reply({ organizationId: 'org_api' }))
    expect(await organizationOf('mgmt', 'hub-1', { AMPLIENCE_ORGANIZATION_ID: '   ' })).toBe(
      'org_api',
    )
  })

  it('refuses rather than building a hub id from nothing', async () => {
    stubFetch(reply({}))
    await expect(organizationOf('mgmt', 'hub-1', {})).rejects.toThrow(/reported no organizationId/)
  })
})

describe('readListeners', () => {
  const page = (
    nodes: { id: string; label: string }[],
    pageInfo: { hasNextPage: boolean; endCursor?: string } = { hasNextPage: false },
  ) =>
    reply({
      data: { cmsHub: { webhookListeners: { edges: nodes.map((node) => ({ node })), pageInfo } } },
    })

  // ⚠️ The bug this exists to prevent: an unpaged read stops at the default
  // page size, and a listener that exists but was not returned reads as
  // missing — which makes the seed create a second one under the same label.
  it('follows the cursor to the end', async () => {
    const { calls } = stubFetch(
      page([{ id: '1', label: 'One' }], { hasNextPage: true, endCursor: 'c1' }),
      page([{ id: '2', label: 'Two' }], { hasNextPage: true, endCursor: 'c2' }),
      page([{ id: '3', label: 'Three' }]),
    )
    const listeners = await readListeners('pat', 'hub')
    expect(listeners.map((l) => l.id)).toEqual(['1', '2', '3'])
    expect(calls.map((c) => (c.body as { variables: { after?: string } }).variables.after)).toEqual(
      [undefined, 'c1', 'c2'],
    )
  })

  // ⚠️ 50 is a hard cap the API refuses past, not a tuning choice.
  it('asks for a page the API will accept', async () => {
    const { calls } = stubFetch(page([]))
    await readListeners('pat', 'hub')
    expect((calls[0]?.body as { variables: { first: number } }).variables.first).toBe(PAGE_SIZE)
    expect(PAGE_SIZE).toBeLessThanOrEqual(50)
  })

  it('skips a null node rather than pushing it', async () => {
    stubFetch(
      reply({
        data: {
          cmsHub: {
            webhookListeners: {
              edges: [{ node: null }, { node: { id: '1', label: 'One' } }],
              pageInfo: { hasNextPage: false },
            },
          },
        },
      }),
    )
    expect(await readListeners('pat', 'hub')).toHaveLength(1)
  })

  it('reads an empty hub as no listeners, not as a failure', async () => {
    stubFetch(reply({ data: { cmsHub: null } }))
    expect(await readListeners('pat', 'hub')).toEqual([])
  })
})

describe('listenerSchemas', () => {
  // One round-trip per listener, and a hub can hold far more than a flow
  // refers to — so only the needed ones are fetched.
  it('fetches only the listeners the flow binds to', async () => {
    const { count } = stubFetch(
      reply({ data: { webhookListener: { id: '1', label: 'Wanted', schema: '{}' } } }),
    )
    const filled = await listenerSchemas(
      'pat',
      [
        { id: '1', label: 'Wanted' },
        { id: '2', label: 'Ignored' },
      ],
      new Set(['Wanted']),
    )
    expect(count()).toBe(1)
    expect(filled[0]).toEqual({ id: '1', label: 'Wanted', schema: '{}' })
    expect(filled[1]).toEqual({ id: '2', label: 'Ignored' })
  })

  it('keeps the listener when the lookup returns nothing', async () => {
    stubFetch(reply({ data: { webhookListener: null } }))
    const filled = await listenerSchemas('pat', [{ id: '1', label: 'Wanted' }], new Set(['Wanted']))
    expect(filled[0]).toEqual({ id: '1', label: 'Wanted' })
  })

  it('copes with no listeners at all', async () => {
    const { count } = stubFetch(reply({}))
    expect(await listenerSchemas('pat', undefined, new Set(['x']))).toEqual([])
    expect(count()).toBe(0)
  })
})

describe('shapeRegistry', () => {
  it('flattens an instance into the shape the pure modules take', () => {
    const shaped = shapeRegistry(
      {
        extensionInstances: [
          {
            id: 'i1',
            label: 'Amplience Dynamic Content',
            extension: { id: 'e1' },
            extensionRelease: { id: 'r1', version: '2.2.0' },
          },
        ],
        listeners: [{ id: 'l1', label: 'Trigger', url: 'https://hooks.test/1' }],
      },
      [{ id: 's1', label: 'Ready' }],
    )
    expect(shaped.extensionInstances?.[0]).toEqual({
      id: 'i1',
      extensionId: 'e1',
      label: 'Amplience Dynamic Content',
      version: '2.2.0',
      releaseId: 'r1',
    })
    expect(shaped.listeners?.[0]?.url).toBe('https://hooks.test/1')
    expect(shaped.workflowStates).toEqual([{ id: 's1', label: 'Ready' }])
  })

  // An instance with no extension cannot be matched to anything, so it would
  // only ever be a row nobody can account for.
  it('drops an instance with no id or no extension', () => {
    const shaped = shapeRegistry(
      { extensionInstances: [{ id: 'i1' }, { extension: { id: 'e1' } }, null] },
      [],
    )
    expect(shaped.extensionInstances).toEqual([])
  })

  it('omits a version it cannot determine rather than inventing one', () => {
    const shaped = shapeRegistry(
      {
        extensionInstances: [
          { id: 'i1', extension: { id: 'e1' }, extensionRelease: { id: 'r1', label: 'Latest' } },
        ],
      },
      [],
    )
    expect(shaped.extensionInstances?.[0]).not.toHaveProperty('version')
    expect(shaped.extensionInstances?.[0]?.releaseId).toBe('r1')
  })

  it('copes with nothing at all', () => {
    expect(shapeRegistry(undefined, undefined)).toEqual({
      extensionInstances: [],
      listeners: [],
      workflowStates: [],
    })
  })
})

describe('readRegistry', () => {
  const instances = (nodes: unknown[]) => reply({ data: { cmsHub: { extensionInstances: nodes } } })
  const noListeners = reply({
    data: { cmsHub: { webhookListeners: { edges: [], pageInfo: { hasNextPage: false } } } },
  })
  const states = (embedded: Record<string, unknown>) => reply({ _embedded: embedded })

  it('uses the richest instance shape when the hub supports it, and warns about nothing', async () => {
    stubFetch(
      instances([
        { id: 'i1', extension: { id: 'e1' }, extensionRelease: { id: 'r1', version: '2.2.0' } },
      ]),
      states({ 'workflow-states': [{ id: 's1', label: 'Ready' }] }),
      noListeners,
    )
    const { registry, warnings } = await readRegistry('pat', 'mgmt', 'hub-1', 'org_1')
    expect(warnings).toEqual([])
    expect(registry.extensionInstances?.[0]?.version).toBe('2.2.0')
    expect(registry.workflowStates).toEqual([{ id: 's1', label: 'Ready' }])
  })

  // ⚠️ The probe exists because hubs differ. Falling back is fine; falling
  // back *silently* is not — the handles get coarser and nothing would say so.
  it('falls back a tier when the API rejects `version`, and says what that costs', async () => {
    const refused = reply({ errors: [{ message: 'Cannot query field "version"' }] })
    stubFetch(
      refused,
      instances([
        { id: 'i1', extension: { id: 'e1' }, extensionRelease: { id: 'r1', label: '2.2.0' } },
      ]),
      states({}),
      noListeners,
    )
    const { registry, warnings } = await readRegistry('pat', 'mgmt', 'hub-1', 'org_1')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/read from the release label instead/)
    expect(registry.extensionInstances?.[0]?.version).toBe('2.2.0')
  })

  it('gives up with the API’s own reason once every shape has failed', async () => {
    stubFetch(reply({ errors: [{ message: 'extensionInstances is not a field' }] }))
    await expect(readRegistry('pat', 'mgmt', 'hub-1', 'org_1')).rejects.toThrow(
      /extensionInstances is not a field/,
    )
  })

  // The embedded key has been seen spelled both ways.
  it('reads workflow states under either spelling', async () => {
    stubFetch(instances([]), states({ workflowStates: [{ id: 's2', label: 'Done' }] }), noListeners)
    const { registry } = await readRegistry('pat', 'mgmt', 'hub-1', 'org_1')
    expect(registry.workflowStates).toEqual([{ id: 's2', label: 'Done' }])
  })

  it('copes with a hub that has no workflow states at all', async () => {
    stubFetch(instances([]), reply({}), noListeners)
    const { registry } = await readRegistry('pat', 'mgmt', 'hub-1', 'org_1')
    expect(registry.workflowStates).toEqual([])
  })
})
