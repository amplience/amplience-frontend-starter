import { describe, expect, it } from 'vitest'

import {
  findOrganization,
  hubsCovered,
  organizationLabelOf,
  organizationsIn,
  publicOrganizations,
  removeToken,
  resolvePat,
  storeToken,
  upsertOrganization,
  type HubRef,
  type Organization,
} from './workforce-token.ts'

const ORG = 'org_cv6BwQhSuDQJBONk'
const OTHER = 'org_somewhereElse00'

const hubs: HubRef[] = [
  { name: 'quadraticlite', label: 'Quadratic Lite', organizationId: ORG },
  { name: 'mattdemo', label: 'Matt Demo', organizationId: ORG },
  { name: 'altayer', label: 'Al Tayer', organizationId: OTHER },
  { name: 'legacy', label: 'Legacy (no org recorded)' },
]

describe('findOrganization', () => {
  const organizations: Organization[] = [{ id: ORG, patToken: 'pat_x' }]

  it('finds by id', () => {
    expect(findOrganization(organizations, ORG)?.patToken).toBe('pat_x')
  })

  it('is undefined for an unknown or blank id', () => {
    expect(findOrganization(organizations, OTHER)).toBeUndefined()
    expect(findOrganization(organizations, '')).toBeUndefined()
    expect(findOrganization(organizations, undefined)).toBeUndefined()
  })
})

describe('resolvePat', () => {
  it('reads the configured token for the organization', () => {
    const resolved = resolvePat([{ id: ORG, patToken: 'pat_x' }], ORG)
    expect(resolved).toEqual({ state: 'configured', token: 'pat_x', source: 'config' })
  })

  it('prefers an environment variable, whatever the organization', () => {
    const resolved = resolvePat([{ id: ORG, patToken: 'pat_config' }], ORG, {
      AMPLIENCE_PAT: 'pat_env',
    })
    expect(resolved).toEqual({ state: 'configured', token: 'pat_env', source: 'env' })
  })

  it("falls back to flows-cli's variable", () => {
    expect(resolvePat([], ORG, { FLOWS_CLI_TOKEN: 'pat_cli' })).toEqual({
      state: 'configured',
      token: 'pat_cli',
      source: 'env',
    })
  })

  it('ignores a blank environment variable', () => {
    expect(resolvePat([{ id: ORG, patToken: 'pat_x' }], ORG, { AMPLIENCE_PAT: '  ' }).source).toBe(
      'config',
    )
  })

  it('trims surrounding whitespace off a pasted token', () => {
    expect(resolvePat([{ id: ORG, patToken: ' pat_x\n' }], ORG).token).toBe('pat_x')
  })

  // The distinction the credentials row is built on: a token that was asked for
  // and is waiting on an admin is not the same as never having started.
  it('reports a requested token as awaiting approval, not missing', () => {
    expect(resolvePat([{ id: ORG, patRequestedAt: '2026-10-09T10:00:00Z' }], ORG).state).toBe(
      'requested',
    )
  })

  it('is missing for an unknown organization', () => {
    expect(resolvePat([{ id: ORG, patToken: 'pat_x' }], OTHER)).toEqual({ state: 'missing' })
    expect(resolvePat([], undefined)).toEqual({ state: 'missing' })
  })
})

describe('upsertOrganization', () => {
  it('adds an organization that is not there yet', () => {
    expect(upsertOrganization([], ORG, { patRequestedAt: 'then' })).toEqual([
      { id: ORG, patRequestedAt: 'then' },
    ])
  })

  it('patches an existing one without touching the others', () => {
    const before: Organization[] = [
      { id: ORG, patToken: 'pat_x' },
      { id: OTHER, patToken: 'pat_y' },
    ]
    expect(upsertOrganization(before, ORG, { label: 'Store Demo' })).toEqual([
      { id: ORG, patToken: 'pat_x', label: 'Store Demo' },
      { id: OTHER, patToken: 'pat_y' },
    ])
  })

  it('does not mutate the array it was given', () => {
    const before: Organization[] = [{ id: ORG }]
    upsertOrganization(before, ORG, { patToken: 'pat_x' })
    expect(before).toEqual([{ id: ORG }])
  })
})

describe('storeToken', () => {
  it('clears an outstanding request once the token arrives', () => {
    const before: Organization[] = [{ id: ORG, patRequestedAt: '2026-10-09T10:00:00Z' }]
    expect(storeToken(before, ORG, 'pat_x')).toEqual([{ id: ORG, patToken: 'pat_x' }])
  })

  it('stores a token for an organization with no entry yet', () => {
    expect(storeToken([], ORG, ' pat_x ')).toEqual([{ id: ORG, patToken: 'pat_x' }])
  })
})

describe('hubsCovered', () => {
  it('lists the hubs one token reaches', () => {
    expect(hubsCovered(hubs, ORG)).toEqual(['Quadratic Lite', 'Matt Demo'])
  })

  it('excludes hubs with no organization recorded', () => {
    expect(hubsCovered(hubs, OTHER)).toEqual(['Al Tayer'])
  })

  it('is empty without an organization', () => {
    expect(hubsCovered(hubs, undefined)).toEqual([])
  })
})

describe('publicOrganizations', () => {
  // The GUI is told whether a token exists, never what it is.
  it('never carries the token itself', () => {
    const published = publicOrganizations([{ id: ORG, patToken: 'pat_secret' }], hubs)
    expect(JSON.stringify(published)).not.toContain('pat_secret')
    expect(published).toEqual([{ id: ORG, hasToken: true, hubs: ['Quadratic Lite', 'Matt Demo'] }])
  })

  it('reports an outstanding request', () => {
    expect(publicOrganizations([{ id: OTHER, patRequestedAt: 'then' }], hubs)).toEqual([
      { id: OTHER, hasToken: false, patRequestedAt: 'then', hubs: ['Al Tayer'] },
    ])
  })
})

describe('organizationLabelOf', () => {
  const relayId = (value: string) => Buffer.from(value, 'utf8').toString('base64')
  const body = (nodes: unknown[]) => ({
    data: { viewer: { organizations: { edges: nodes.map((node) => ({ node })) } } },
  })

  // Hubs come back as Relay global ids, and organizations are no different —
  // but everything on our side holds the bare org_… the Management API reports.
  it('matches a Relay global id against the bare organization id', () => {
    const found = organizationLabelOf(
      body([{ id: relayId(`Organization:${ORG}`), name: 'store-demo', label: 'Store Demo' }]),
      ORG,
    )
    expect(found).toBe('Store Demo')
  })

  it('matches a bare id too, in case it is ever returned unwrapped', () => {
    expect(organizationLabelOf(body([{ id: ORG, label: 'Store Demo' }]), ORG)).toBe('Store Demo')
  })

  it('falls back to the name when there is no label', () => {
    expect(organizationLabelOf(body([{ id: ORG, name: 'store-demo' }]), ORG)).toBe('store-demo')
  })

  it('is undefined for an organization that is not in the response', () => {
    expect(organizationLabelOf(body([{ id: OTHER, label: 'Elsewhere' }]), ORG)).toBeUndefined()
  })

  it('is undefined for a blank label, a blank id and a shapeless response', () => {
    expect(organizationLabelOf(body([{ id: ORG, label: '  ' }]), ORG)).toBeUndefined()
    expect(organizationLabelOf(body([{ id: ORG, label: 'Store Demo' }]), '')).toBeUndefined()
    expect(organizationLabelOf({ errors: [{ message: 'denied' }] }, ORG)).toBeUndefined()
  })
})

describe('organizationsIn', () => {
  const relayId = (value: string) => Buffer.from(value, 'utf8').toString('base64')
  const body = (nodes: unknown[]) => ({
    data: { viewer: { organizations: { edges: nodes.map((node) => ({ node })) } } },
  })

  it('lists every organization a token can see, with bare ids', () => {
    expect(
      organizationsIn(
        body([
          { id: relayId(`Organization:${ORG}`), label: 'Store Demo' },
          { id: relayId(`Organization:${OTHER}`), name: 'elsewhere' },
        ]),
      ),
    ).toEqual([
      { id: ORG, label: 'Store Demo' },
      { id: OTHER, label: 'elsewhere' },
    ])
  })

  it('keeps an organization with no usable label at all', () => {
    expect(organizationsIn(body([{ id: ORG, label: '  ' }]))).toEqual([{ id: ORG }])
  })

  it('is empty for a denial or a shapeless response', () => {
    expect(organizationsIn({ errors: [{ message: 'denied' }] })).toEqual([])
    expect(organizationsIn(null)).toEqual([])
  })
})

describe('removeToken', () => {
  it('forgets the token and any outstanding request', () => {
    const before: Organization[] = [
      { id: ORG, patToken: 'pat_x', patRequestedAt: 'then' },
      { id: OTHER, patToken: 'pat_y' },
    ]
    expect(removeToken(before, ORG)).toEqual([{ id: OTHER, patToken: 'pat_y' }])
  })

  // A label is worth keeping — it is the one thing that cost an API call.
  it('keeps the entry when it still has a label on it', () => {
    expect(removeToken([{ id: ORG, label: 'Store Demo', patToken: 'pat_x' }], ORG)).toEqual([
      { id: ORG, label: 'Store Demo' },
    ])
  })

  it('leaves an organization it does not know alone', () => {
    expect(removeToken([{ id: OTHER, patToken: 'pat_y' }], ORG)).toEqual([
      { id: OTHER, patToken: 'pat_y' },
    ])
  })
})
