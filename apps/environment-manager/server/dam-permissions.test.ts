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

  it('normalises error entries that are not objects', () => {
    // A gateway between us and the API can return a plain-string error list.
    // Stringifying keeps the message readable instead of yielding "undefined".
    expect(gqlErrors({ errors: ['boom', null] })).toEqual([
      { message: 'boom' },
      { message: 'null' },
    ])
  })

  it('falls back to "Unknown error" when an entry carries only a code', () => {
    expect(gqlErrors({ errors: [{ extensions: { code: 'FORBIDDEN' } }] })).toEqual([
      { message: 'Unknown error', code: 'FORBIDDEN' },
    ])
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

  it('skips hubs that expose no repository edges', () => {
    // A credential can see a media hub without holding any AssetStore grant on
    // it — that hub must not abort the walk over the hubs that follow it.
    const body = {
      data: {
        viewer: {
          mediaHubs: {
            edges: [
              { node: { assetRepositories: null } },
              { node: { assetRepositories: { edges: [{ node: { id: 'r2', label: 'Beta' } }] } } },
            ],
          },
        },
      },
    }
    expect(extractRepositories(body)).toEqual([{ id: 'r2', label: 'Beta' }])
  })

  it('skips repository edges with no usable node, and labels an unlabelled repo by id', () => {
    // The write probe names the repository it tested back to the operator, so a
    // repo with no label has to fall back to something identifying, not "".
    const body = {
      data: {
        viewer: {
          mediaHubs: {
            edges: [
              {
                node: {
                  assetRepositories: {
                    edges: [
                      { node: null },
                      { node: {} }, // no id — unusable, dropped
                      { node: { id: 'r3' } }, // no label — falls back to the id
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    }
    expect(extractRepositories(body)).toEqual([{ id: 'r3', label: 'r3' }])
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

  it('is error — not denied — on a server-side HTTP failure', () => {
    // A 500 or a 429 says nothing about the credential's grants. Reporting it
    // as "denied" would send the operator off fixing permissions that are fine.
    for (const status of [429, 500, 502]) {
      const probe = readProbeState({ status, body: null })
      expect(probe.state).toBe('error')
      expect(probe.detail).toContain(String(status))
    }
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

  it('is denied on an HTTP 401/403 from the create call', async () => {
    // The gateway rejects some missing grants at the transport layer rather
    // than as a GraphQL error, so the status has to be read before the body.
    for (const status of [401, 403]) {
      const gql = stubGql([['createAsset', { status, body: null }]])
      const probe = await writeProbe(gql, REPO, { assetName: FIXED_NAME })
      expect(probe.state).toBe('denied')
      expect(probe.detail).toContain(String(status))
    }
  })

  it('is error when create reports success but returns no asset id', async () => {
    // Without an id there is nothing to delete, so treating this as "ok" would
    // silently leave a throwaway asset in the customer's media library.
    const gql = stubGql([['createAsset', OK({ data: { createAsset: {} } })]])
    const probe = await writeProbe(gql, REPO, { assetName: FIXED_NAME })
    expect(probe.state).toBe('error')
    expect(probe.detail).toContain('no asset id returned')
  })

  it('generates a unique throwaway asset name when none is injected', async () => {
    // Two operators probing the same store concurrently must not collide on the
    // asset name — the default is only used outside tests, so it needs pinning.
    const queries: string[] = []
    const gql: GqlFetch = (query) => {
      queries.push(query)
      return Promise.resolve(
        query.includes('createAsset')
          ? OK({ data: { createAsset: { id: 'asset-9' } } })
          : OK({ data: { deleteAssets: 1 } }),
      )
    }
    const probe = await writeProbe(gql, REPO)
    expect(probe.state).toBe('ok')
    const name = /name: "([^"]+)"/.exec(queries[0])?.[1]
    // Constrained to [a-z0-9-] so it can't break out of the mutation string.
    expect(name).toMatch(/^ql-cred-check-[a-z0-9]+-[a-z0-9]+$/)
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
