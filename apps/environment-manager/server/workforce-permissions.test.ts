import { describe, expect, it } from 'vitest'

import { type GqlFetch, type GqlResult } from './graphql.ts'
import type { FetchJson } from './permissions.ts'
import {
  buildWorkforceCheck,
  classify,
  cmsHubIdFor,
  dcHubIdOf,
  decodeId,
  isValidationError,
  organizationIdOf,
  resolveCmsHubId,
  writeProbe,
} from './workforce-permissions.ts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DC_HUB = '6a7c803601ac4b1a73b30ebe'
const ORG = 'org_cv6BwQhSuDQJBONk'
const opaque = (value: string) => Buffer.from(value, 'utf8').toString('base64')
const CMS_HUB = opaque(`CMSHub:${ORG}/${DC_HUB}`)
const FLOW_ID = opaque('ContentFlow:770ced14-c662-4ec7-bd31-6bc75128e970')

const ok = (body: unknown): GqlResult => ({ status: 200, body })

/** The gateway's habit of reporting a denial as HTTP 200. */
const deniedAs200 = ok({ errors: [{ message: 'Request failed with status code: "403"' }] })

const validationFailure = ok({
  errors: [
    {
      message: 'Invalid workflow provided',
      extensions: { reason: 'WORKFLOW_VALIDATION_FAILED', code: 'BAD_USER_INPUT' },
    },
  ],
})

/** A DC hub read that answers only for this hub's URL, and throws otherwise. */
function stubHub(res: { status: number; body: unknown }): FetchJson {
  return (url) => {
    if (!url.endsWith(`/hubs/${DC_HUB}`)) throw new Error(`unstubbed URL: ${url}`)
    return Promise.resolve(res)
  }
}

const hubOk = stubHub({ status: 200, body: { id: DC_HUB, organizationId: ORG } })

/**
 * A GqlFetch stub that answers by matching a substring of the query and throws
 * on anything unexpected, so a query this suite forgot to stub fails loudly
 * rather than silently reusing another route's answer.
 */
function stubFetch(routes: Record<string, GqlResult>): {
  fetch: GqlFetch
  calls: { query: string; variables?: Record<string, unknown> }[]
} {
  const calls: { query: string; variables?: Record<string, unknown> }[] = []
  const fetch: GqlFetch = (query, variables) => {
    calls.push(variables === undefined ? { query } : { query, variables })
    for (const [needle, res] of Object.entries(routes)) {
      if (query.includes(needle)) return Promise.resolve(res)
    }
    throw new Error(`unstubbed query: ${query.slice(0, 60)}`)
  }
  return { fetch, calls }
}

const noGql: GqlFetch = () => {
  throw new Error('GraphQL should not have been called')
}

// ── Opaque ids ────────────────────────────────────────────────────────────────

describe('cmsHubIdFor', () => {
  it('builds the opaque id Workforce addresses a hub by', () => {
    expect(cmsHubIdFor(ORG, DC_HUB)).toBe(CMS_HUB)
  })

  it('round-trips through decodeId and dcHubIdOf', () => {
    expect(decodeId(cmsHubIdFor(ORG, DC_HUB))).toBe(`CMSHub:${ORG}/${DC_HUB}`)
    expect(dcHubIdOf(cmsHubIdFor(ORG, DC_HUB))).toBe(DC_HUB)
  })
})

describe('decodeId', () => {
  it('rejects a value that does not decode to a Type:value shape', () => {
    expect(decodeId(opaque('not an id at all'))).toBeUndefined()
    expect(decodeId('!!!not base64!!!')).toBeUndefined()
  })
})

describe('dcHubIdOf', () => {
  it('returns undefined for another id type', () => {
    expect(dcHubIdOf(FLOW_ID)).toBeUndefined()
  })

  it('returns undefined when there is no org/hub separator', () => {
    expect(dcHubIdOf(opaque('CMSHub:justonesegment'))).toBeUndefined()
  })
})

describe('organizationIdOf', () => {
  it('reads organizationId off a hub body', () => {
    expect(organizationIdOf({ id: DC_HUB, organizationId: ORG })).toBe(ORG)
  })

  it('returns undefined when it is missing or empty', () => {
    expect(organizationIdOf({ id: DC_HUB })).toBeUndefined()
    expect(organizationIdOf({ organizationId: '' })).toBeUndefined()
    expect(organizationIdOf(null)).toBeUndefined()
  })
})

// ── Classification ────────────────────────────────────────────────────────────

describe('classify', () => {
  it('reads a clean 200 as ok', () => {
    expect(classify(ok({ data: {} }), 'read').state).toBe('ok')
  })

  it('treats 401 and 403 as denied', () => {
    expect(classify({ status: 401, body: null }, 'read').state).toBe('denied')
    expect(classify({ status: 403, body: null }, 'read').state).toBe('denied')
  })

  it('treats the 403-as-200 gateway quirk as denied', () => {
    expect(classify(deniedAs200, 'read').state).toBe('denied')
  })

  it('carries the API wording and code through on a denial', () => {
    const res = classify(
      ok({ errors: [{ message: 'Forbidden: missing grant', extensions: { code: 'FORBIDDEN' } }] }),
      'read',
    )
    expect(res.state).toBe('denied')
    expect(res.detail).toContain('Forbidden: missing grant')
    expect(res.detail).toContain('FORBIDDEN')
  })

  it('shows the raw 403-as-200 message rather than a bare "denied"', () => {
    expect(classify(deniedAs200, 'read').detail).toContain('status code: "403"')
  })

  it('treats a non-auth GraphQL error as error, not denied', () => {
    const res = classify(ok({ errors: [{ message: 'Cannot query field "nope"' }] }), 'read')
    expect(res.state).toBe('error')
    expect(res.detail).toContain('Cannot query field')
  })

  it('treats a 5xx as error', () => {
    expect(classify({ status: 500, body: null }, 'read').state).toBe('error')
  })

  it('surfaces the GraphQL message on a 400, not just the status', () => {
    const res = classify(
      {
        status: 400,
        body: { errors: [{ message: 'Cannot query field "cmsHubs" on type "User".' }] },
      },
      'read',
    )
    expect(res.state).toBe('error')
    expect(res.detail).toContain('Cannot query field "cmsHubs"')
    expect(res.detail).toContain('HTTP 400')
  })
})

describe('isValidationError', () => {
  it('recognises a workflow validation failure', () => {
    expect(isValidationError(validationFailure)).toBe(true)
  })

  it('does not mistake an auth denial for a validation failure', () => {
    expect(isValidationError(deniedAs200)).toBe(false)
  })

  it('is false for a clean response', () => {
    expect(isValidationError(ok({ data: {} }))).toBe(false)
  })
})

// ── Hub resolution ────────────────────────────────────────────────────────────

describe('resolveCmsHubId', () => {
  it('short-circuits when the opaque id is supplied', async () => {
    const res = await resolveCmsHubId(stubHub({ status: 500, body: null }), DC_HUB, {
      cmsHubId: CMS_HUB,
    })
    expect(res).toEqual({ cmsHubId: CMS_HUB, state: 'ok' })
  })

  it('constructs from a supplied organization id without reading the hub', async () => {
    const res = await resolveCmsHubId(stubHub({ status: 500, body: null }), DC_HUB, {
      organizationId: ORG,
    })
    expect(res).toEqual({ cmsHubId: CMS_HUB, state: 'ok' })
  })

  it('reads organizationId off the hub and constructs the id', async () => {
    expect(await resolveCmsHubId(hubOk, DC_HUB)).toEqual({ cmsHubId: CMS_HUB, state: 'ok' })
  })

  it('reports denied when the hub read is refused', async () => {
    expect((await resolveCmsHubId(stubHub({ status: 403, body: null }), DC_HUB)).state).toBe(
      'denied',
    )
  })

  it('reports error when the hub read fails for another reason', async () => {
    expect((await resolveCmsHubId(stubHub({ status: 500, body: null }), DC_HUB)).state).toBe(
      'error',
    )
  })

  it('reports unknown when the hub reads fine but carries no organizationId', async () => {
    const res = await resolveCmsHubId(stubHub({ status: 200, body: { id: DC_HUB } }), DC_HUB)
    expect(res.state).toBe('unknown')
    expect(res.detail).toContain('no organizationId')
    expect(res.cmsHubId).toBeUndefined()
  })
})

// ── Write probe ───────────────────────────────────────────────────────────────

const label = () => 'ql-cred-check-test'

describe('writeProbe', () => {
  it('creates and deletes a throwaway flow', async () => {
    const { fetch, calls } = stubFetch({
      createContentFlow: ok({ data: { createContentFlow: { id: FLOW_ID } } }),
      deleteContentFlow: ok({ data: { deleteContentFlow: true } }),
    })
    expect(await writeProbe(fetch, CMS_HUB, { flowLabel: label })).toEqual({ state: 'ok' })
    expect(calls).toHaveLength(2)
    expect(calls[0]?.variables).toMatchObject({ hubId: CMS_HUB, label: 'ql-cred-check-test' })
    expect(calls[1]?.variables).toEqual({ flowId: FLOW_ID })
  })

  it('sends an empty graph as the probe flow', async () => {
    const { fetch, calls } = stubFetch({
      createContentFlow: ok({ data: { createContentFlow: { id: FLOW_ID } } }),
      deleteContentFlow: ok({ data: {} }),
    })
    await writeProbe(fetch, CMS_HUB, { flowLabel: label })
    expect(JSON.parse(String(calls[0]?.variables?.flow))).toEqual({
      actions: [],
      edges: [],
      virtualActions: [],
    })
  })

  it('reports unknown when the probe flow itself is rejected', async () => {
    const { fetch } = stubFetch({ createContentFlow: validationFailure })
    const res = await writeProbe(fetch, CMS_HUB, { flowLabel: label })
    expect(res.state).toBe('unknown')
    expect(res.detail).toContain('probe flow was rejected')
  })

  it('reports denied on an authorization failure', async () => {
    const { fetch } = stubFetch({ createContentFlow: deniedAs200 })
    expect((await writeProbe(fetch, CMS_HUB, { flowLabel: label })).state).toBe('denied')
  })

  it('reports error when no flow id comes back', async () => {
    const { fetch } = stubFetch({ createContentFlow: ok({ data: { createContentFlow: {} } }) })
    const res = await writeProbe(fetch, CMS_HUB, { flowLabel: label })
    expect(res.state).toBe('error')
    expect(res.detail).toContain('no flow id')
  })

  it('still reports ok when cleanup fails, naming the leftover flow', async () => {
    const { fetch } = stubFetch({
      createContentFlow: ok({ data: { createContentFlow: { id: FLOW_ID } } }),
      deleteContentFlow: { status: 500, body: null },
    })
    const res = await writeProbe(fetch, CMS_HUB, { flowLabel: label })
    expect(res.state).toBe('ok')
    expect(res.detail).toContain('ql-cred-check-test')
    expect(res.detail).toContain('delete it manually')
  })
})

// ── Report row ────────────────────────────────────────────────────────────────

describe('buildWorkforceCheck', () => {
  it('reports ok/ok when both probes pass', async () => {
    const { fetch } = stubFetch({
      contentFlows: ok({ data: { cmsHub: { contentFlows: { edges: [] } } } }),
      createContentFlow: ok({ data: { createContentFlow: { id: FLOW_ID } } }),
      deleteContentFlow: ok({ data: {} }),
    })
    expect(await buildWorkforceCheck(fetch, hubOk, DC_HUB, { flowLabel: label })).toEqual({
      key: 'workforce',
      label: 'Workforce content flows',
      read: 'ok',
      write: 'ok',
    })
  })

  it('addresses the hub by its constructed opaque id', async () => {
    const { fetch, calls } = stubFetch({
      contentFlows: ok({ data: { cmsHub: { contentFlows: { edges: [] } } } }),
      createContentFlow: ok({ data: { createContentFlow: { id: FLOW_ID } } }),
      deleteContentFlow: ok({ data: {} }),
    })
    await buildWorkforceCheck(fetch, hubOk, DC_HUB, { flowLabel: label })
    expect(calls[0]?.variables).toEqual({ hubId: CMS_HUB })
  })

  it('skips write when read is denied', async () => {
    const { fetch } = stubFetch({ contentFlows: deniedAs200 })
    const check = await buildWorkforceCheck(fetch, hubOk, DC_HUB, { flowLabel: label })
    expect(check).toMatchObject({ read: 'denied', write: 'skipped' })
  })

  it('skips both probes, and never calls GraphQL, when the hub has no org id', async () => {
    const check = await buildWorkforceCheck(
      noGql,
      stubHub({ status: 200, body: { id: DC_HUB } }),
      DC_HUB,
      { flowLabel: label },
    )
    expect(check).toMatchObject({ read: 'unknown', write: 'skipped' })
    expect(check.detail).toContain('no organizationId')
  })
})
