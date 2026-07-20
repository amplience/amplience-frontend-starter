import { describe, expect, it } from 'vitest'

import {
  buildDamCheck,
  extractRepositories,
  gqlErrors,
  isAuthError,
  pickRepository,
  readProbeState,
  writeProbe,
  type GqlFetch,
  type GqlResult,
} from './dam-permissions.ts'

// ── Fixtures ────────────────────────────────────────────────────────────────────

/** A viewer→mediaHubs→assetRepositories body with the given repositories. */
function reposBody(repos: { id: string; label: string }[]): unknown {
  return {
    data: {
      viewer: {
        mediaHubs: {
          edges: [{ node: { assetRepositories: { edges: repos.map((node) => ({ node })) } } }],
        },
      },
    },
  }
}

const ONE_REPO = reposBody([{ id: 'repo-1', label: 'Quadratic Assets' }])

/**
 * Build a GqlFetch stub from a query-substring → response table (first match
 * wins), so a single stub can answer the read query, createAsset and
 * deleteAssets differently.
 */
function stubGql(routes: [string, GqlResult][]): GqlFetch {
  return (query) => {
    const match = routes.find(([needle]) => query.includes(needle))
    if (!match) throw new Error(`Unstubbed query: ${query}`)
    return Promise.resolve(match[1])
  }
}

const OK = (body: unknown): GqlResult => ({ status: 200, body })

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('gqlErrors', () => {
  it('returns the errors array with codes', () => {
    expect(gqlErrors({ errors: [{ message: 'nope', extensions: { code: 'FORBIDDEN' } }] })).toEqual(
      [{ message: 'nope', code: 'FORBIDDEN' }],
    )
  })

  it('is undefined when there are no errors', () => {
    expect(gqlErrors({ data: {} })).toBeUndefined()
    expect(gqlErrors({ errors: [] })).toBeUndefined()
    expect(gqlErrors(null)).toBeUndefined()
  })
})

describe('isAuthError', () => {
  it('detects auth failures by code', () => {
    expect(isAuthError([{ message: 'x', code: 'FORBIDDEN' }])).toBe(true)
    expect(isAuthError([{ message: 'x', code: 'UNAUTHENTICATED' }])).toBe(true)
  })

  it('detects auth failures by message', () => {
    expect(isAuthError([{ message: 'User is not permitted to do this' }])).toBe(true)
  })

  it('detects the DAM gateway 403 message shape', () => {
    // Real message returned when a credential lacks a DAM:ASSET STORE grant.
    expect(isAuthError([{ message: 'Request failed with status code: "403"' }])).toBe(true)
    expect(isAuthError([{ message: 'Request failed with status code 401' }])).toBe(true)
  })

  it('is false for non-auth errors and no errors', () => {
    expect(isAuthError([{ message: 'validation failed', code: 'BAD_USER_INPUT' }])).toBe(false)
    expect(isAuthError([{ message: 'Request failed with status code 500' }])).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
  })
})

describe('extractRepositories', () => {
  it('flattens repositories across media hubs', () => {
    expect(extractRepositories(ONE_REPO)).toEqual([{ id: 'repo-1', label: 'Quadratic Assets' }])
  })

  it('returns [] for empty or malformed bodies', () => {
    expect(extractRepositories(reposBody([]))).toEqual([])
    expect(extractRepositories({})).toEqual([])
    expect(extractRepositories(null)).toEqual([])
  })
})

describe('pickRepository', () => {
  const repos = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ]

  it('returns the first repository by default', () => {
    expect(pickRepository(repos)).toEqual({ id: 'a', label: 'Alpha' })
  })

  it('matches a repository by label case-insensitively', () => {
    expect(pickRepository(repos, 'beta')).toEqual({ id: 'b', label: 'Beta' })
  })

  it('is undefined when no label matches', () => {
    expect(pickRepository(repos, 'gamma')).toBeUndefined()
  })
})

// ── Read probe ──────────────────────────────────────────────────────────────────

describe('readProbeState', () => {
  it('is ok with repositories present', () => {
    const probe = readProbeState(OK(ONE_REPO))
    expect(probe.state).toBe('ok')
    expect(probe.repositories).toHaveLength(1)
  })

  it('is denied on an HTTP 403', () => {
    expect(readProbeState({ status: 403, body: null }).state).toBe('denied')
  })

  it('is denied on a GraphQL auth error', () => {
    const probe = readProbeState(
      OK({ errors: [{ message: 'forbidden', extensions: { code: 'FORBIDDEN' } }] }),
    )
    expect(probe.state).toBe('denied')
  })

  it('is denied on the DAM gateway 403 message (real-world shape)', () => {
    const probe = readProbeState(
      OK({ errors: [{ message: 'Request failed with status code: "403"' }] }),
    )
    expect(probe.state).toBe('denied')
  })

  it('is denied when the credential sees no repositories', () => {
    const probe = readProbeState(OK(reposBody([])))
    expect(probe.state).toBe('denied')
    expect(probe.detail).toContain('no asset repositories')
  })

  it('is error on a non-auth GraphQL error', () => {
    const probe = readProbeState(OK({ errors: [{ message: 'boom' }] }))
    expect(probe.state).toBe('error')
    expect(probe.detail).toContain('boom')
  })
})

// ── Write probe ──────────────────────────────────────────────────────────────────

const REPO = { id: 'repo-1', label: 'Quadratic Assets' }
const FIXED_NAME = () => 'ql-cred-check-test'

describe('writeProbe', () => {
  it('is ok when create then delete both succeed', async () => {
    const gql = stubGql([
      ['createAsset', OK({ data: { createAsset: { id: 'asset-9' } } })],
      ['deleteAssets', OK({ data: { deleteAssets: 1 } })],
    ])
    const probe = await writeProbe(gql, REPO, { assetName: FIXED_NAME })
    expect(probe.state).toBe('ok')
    expect(probe.detail).toContain('Quadratic Assets')
  })

  it('is denied when create is an authorization error', async () => {
    const gql = stubGql([
      [
        'createAsset',
        OK({ errors: [{ message: 'forbidden', extensions: { code: 'FORBIDDEN' } }] }),
      ],
    ])
    const probe = await writeProbe(gql, REPO, { assetName: FIXED_NAME })
    expect(probe.state).toBe('denied')
  })

  it('is error on a non-auth create failure', async () => {
    const gql = stubGql([['createAsset', OK({ errors: [{ message: 'bad input' }] })]])
    const probe = await writeProbe(gql, REPO, { assetName: FIXED_NAME })
    expect(probe.state).toBe('error')
    expect(probe.detail).toContain('bad input')
  })

  it('stays ok but flags a cleanup failure', async () => {
    const gql = stubGql([
      ['createAsset', OK({ data: { createAsset: { id: 'asset-9' } } })],
      ['deleteAssets', OK({ errors: [{ message: 'delete failed' }] })],
    ])
    const probe = await writeProbe(gql, REPO, { assetName: FIXED_NAME })
    expect(probe.state).toBe('ok')
    expect(probe.detail).toContain('asset-9')
    expect(probe.detail).toContain('delete manually')
  })
})

// ── Combined report row ───────────────────────────────────────────────────────

describe('buildDamCheck', () => {
  it('reports full read + write capability on the happy path', async () => {
    const gql = stubGql([
      ['viewer', OK(ONE_REPO)],
      ['createAsset', OK({ data: { createAsset: { id: 'asset-9' } } })],
      ['deleteAssets', OK({ data: { deleteAssets: 1 } })],
    ])
    const check = await buildDamCheck(gql, { assetName: FIXED_NAME })
    expect(check).toMatchObject({ key: 'dam', read: 'ok', write: 'ok' })
  })

  it('skips the write probe when read is denied', async () => {
    const gql = stubGql([['viewer', { status: 403, body: null }]])
    const check = await buildDamCheck(gql, { assetName: FIXED_NAME })
    expect(check).toMatchObject({ read: 'denied', write: 'skipped' })
  })

  it('skips the write probe when no repository matches the requested label', async () => {
    const gql = stubGql([['viewer', OK(ONE_REPO)]])
    const check = await buildDamCheck(gql, {
      repositoryLabel: 'Nonexistent',
      assetName: FIXED_NAME,
    })
    expect(check).toMatchObject({ read: 'ok', write: 'skipped' })
    expect(check.detail).toContain('Nonexistent')
  })

  it('surfaces a denied write while read is ok', async () => {
    const gql = stubGql([
      ['viewer', OK(ONE_REPO)],
      [
        'createAsset',
        OK({ errors: [{ message: 'forbidden', extensions: { code: 'FORBIDDEN' } }] }),
      ],
    ])
    const check = await buildDamCheck(gql, { assetName: FIXED_NAME })
    expect(check).toMatchObject({ read: 'ok', write: 'denied' })
  })
})
