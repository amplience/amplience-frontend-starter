import { describe, expect, it, vi } from 'vitest'

import { flowPageIn, MAX_PAGES, PAGE_SIZE, readHubFlows } from './content-flows.ts'
import type { GqlFetch, GqlResult } from './graphql.ts'

const flow = (id: string, label: string, extra: Record<string, unknown> = {}) => ({
  id,
  label,
  status: 'ENABLED',
  updatedDate: '2026-10-01T09:00:00Z',
  lastRunDate: '2026-10-02T11:30:00Z',
  ...extra,
})

/** A `contentFlows` response body. */
const page = (
  flows: Record<string, unknown>[],
  pageInfo: { hasNextPage: boolean; endCursor?: string | null } = { hasNextPage: false },
): GqlResult => ({
  status: 200,
  body: {
    data: {
      cmsHub: {
        contentFlows: {
          edges: flows.map((node) => ({ node })),
          pageInfo: { endCursor: null, ...pageInfo },
        },
      },
    },
  },
})

/** Replays the given pages in order, recording the `after` it was asked for. */
function pager(pages: GqlResult[]) {
  const cursors: (string | undefined)[] = []
  let call = 0
  const gql: GqlFetch = (_query, variables) => {
    cursors.push(variables?.after as string | undefined)
    const next = pages[Math.min(call, pages.length - 1)]!
    call += 1
    return Promise.resolve(next)
  }
  return { gql, cursors, calls: () => call }
}

describe('flowPageIn', () => {
  it('flattens the connection', () => {
    const parsed = flowPageIn(page([flow('a', 'Localize')]).body)
    expect(parsed.flows).toEqual([
      {
        id: 'a',
        label: 'Localize',
        status: 'ENABLED',
        updatedDate: '2026-10-01T09:00:00Z',
        lastRunDate: '2026-10-02T11:30:00Z',
      },
    ])
    expect(parsed.hasNextPage).toBe(false)
  })

  it('carries the cursor only when there is a next page', () => {
    expect(flowPageIn(page([], { hasNextPage: true, endCursor: 'c1' }).body).endCursor).toBe('c1')
    expect(flowPageIn(page([]).body).endCursor).toBeUndefined()
  })

  it('omits optional fields rather than writing nulls', () => {
    const parsed = flowPageIn(page([{ id: 'a', label: 'L', status: null }]).body)
    expect(parsed.flows[0]).toEqual({ id: 'a', label: 'L' })
  })

  // `lastRunDate` is nullable in the schema: a flow that has never run reports
  // null, and "never" has to survive as an absent field rather than a date.
  it('keeps a never-run flow distinguishable from one that ran', () => {
    const parsed = flowPageIn(
      page([{ id: 'a', label: 'Never', status: 'ENABLED', lastRunDate: null }, flow('b', 'Ran')])
        .body,
    )
    expect(parsed.flows[0]).not.toHaveProperty('lastRunDate')
    expect(parsed.flows[1]?.lastRunDate).toBe('2026-10-02T11:30:00Z')
  })

  it('reads the three statuses the enum defines, verbatim', () => {
    const parsed = flowPageIn(
      page([
        flow('a', 'On', { status: 'ENABLED' }),
        flow('b', 'Off', { status: 'DISABLED' }),
        flow('c', 'Stopped', { status: 'QUARANTINED' }),
      ]).body,
    )
    expect(parsed.flows.map((f) => f.status)).toEqual(['ENABLED', 'DISABLED', 'QUARANTINED'])
  })

  // The grid matches on the label, so a flow without one could never be shown
  // against a fixture — it would only ever be a cell nobody can account for.
  it('drops a node with no id or no label', () => {
    const parsed = flowPageIn(page([{ id: 'a' }, { label: 'L' }, flow('c', 'Keep')]).body)
    expect(parsed.flows.map((f) => f.id)).toEqual(['c'])
  })

  it('reads an unrecognisable body as an empty page rather than throwing', () => {
    expect(flowPageIn(null)).toEqual({ flows: [], hasNextPage: false })
    expect(flowPageIn({ data: { cmsHub: null } })).toEqual({ flows: [], hasNextPage: false })
  })
})

describe('readHubFlows', () => {
  it('asks for a page the API will accept', async () => {
    const gql = vi.fn<GqlFetch>().mockResolvedValue(page([flow('a', 'L')]))
    await readHubFlows(gql, 'hub')
    // ⚠️ 50 is a hard cap the API refuses past, not a tuning choice.
    expect(gql.mock.calls[0]?.[1]).toEqual({ hubId: 'hub', first: PAGE_SIZE })
    expect(PAGE_SIZE).toBeLessThanOrEqual(50)
  })

  // The DoD case: more than one page, following the cursor.
  it('follows the cursor across pages and concatenates them', async () => {
    const { gql, cursors, calls } = pager([
      page([flow('a', 'One'), flow('b', 'Two')], { hasNextPage: true, endCursor: 'c1' }),
      page([flow('c', 'Three')], { hasNextPage: true, endCursor: 'c2' }),
      page([flow('d', 'Four')]),
    ])
    const result = await readHubFlows(gql, 'hub')
    expect(result).toEqual({
      ok: true,
      flows: [flow('a', 'One'), flow('b', 'Two'), flow('c', 'Three'), flow('d', 'Four')],
    })
    expect(cursors).toEqual([undefined, 'c1', 'c2'])
    expect(calls()).toBe(3)
  })

  it('sends no cursor on the first page', async () => {
    const { gql, cursors } = pager([page([])])
    await readHubFlows(gql, 'hub')
    expect(cursors[0]).toBeUndefined()
  })

  // A connection claiming another page while handing back the same cursor is a
  // server bug; in a panel that fans out across fourteen hubs it would be an
  // infinite loop, so it stops with what it has.
  it('stops when the cursor repeats rather than looping', async () => {
    const { gql, calls } = pager([page([flow('a', 'L')], { hasNextPage: true, endCursor: 'same' })])
    const result = await readHubFlows(gql, 'hub')
    expect(result.ok).toBe(true)
    expect(calls()).toBe(2)
  })

  it('stops at the page ceiling', async () => {
    let n = 0
    const gql: GqlFetch = () => {
      n += 1
      return Promise.resolve(
        page([flow(`f${n}`, `L${n}`)], { hasNextPage: true, endCursor: `c${n}` }),
      )
    }
    const result = await readHubFlows(gql, 'hub')
    expect(result.ok).toBe(true)
    expect(n).toBe(MAX_PAGES)
  })

  // Not an error, and never a request: asking without a token produces a
  // denial, and a denial is what a *wrong* token looks like.
  it('reports no-token without calling the API', async () => {
    const gql = vi.fn<GqlFetch>()
    expect(await readHubFlows(undefined, 'hub')).toEqual({ ok: false, reason: 'no-token' })
    expect(gql).not.toHaveBeenCalled()
  })

  it('tells a refused token apart from a broken query', async () => {
    const denied: GqlResult = {
      status: 200,
      body: { errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] },
    }
    expect(await readHubFlows(() => Promise.resolve(denied), 'hub')).toEqual({
      ok: false,
      reason: 'denied',
      detail: 'Forbidden',
    })

    const broken: GqlResult = {
      status: 200,
      body: { errors: [{ message: 'Cannot query field "somethingElse"' }] },
    }
    const result = await readHubFlows(() => Promise.resolve(broken), 'hub')
    expect(result).toEqual({
      ok: false,
      reason: 'error',
      detail: 'Cannot query field "somethingElse"',
    })
  })

  it('reports an HTTP failure and a thrown fetch as errors', async () => {
    expect(await readHubFlows(() => Promise.resolve({ status: 502, body: null }), 'hub')).toEqual({
      ok: false,
      reason: 'error',
      detail: 'HTTP 502',
    })
    expect(await readHubFlows(() => Promise.reject(new Error('socket hang up')), 'hub')).toEqual({
      ok: false,
      reason: 'error',
      detail: 'socket hang up',
    })
  })

  // One hub failing must not take the fleet with it — the route fans out, so a
  // rejected promise here would lose every other hub's column. Rejecting with a
  // non-Error is the point of the test, hence the disable: `fetch` and anything
  // between us and it can throw a string, and `messageOf` has to cope.
  it('never rejects, whatever the transport does', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      readHubFlows(() => Promise.reject('not an Error'), 'hub'),
    ).resolves.toMatchObject({ ok: false, reason: 'error' })
  })
})
