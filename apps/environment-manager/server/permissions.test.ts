import { describe, expect, it } from 'vitest'

import {
  buildPermissionsReport,
  combinedWriteState,
  extractLinks,
  readState,
  writeState,
  type FetchJson,
  type HalLinks,
  type PermissionsEnv,
} from './permissions.ts'

const API = 'https://api.amplience.net/v2/content'

const ENV: PermissionsEnv = {
  hubId: 'hub123',
  repoContent: 'repoC',
  repoSlots: 'repoS',
  repoSiteComponents: '',
}

const FULL_HUB_LINKS: HalLinks = {
  'create-workflow-state': { href: `${API}/hubs/hub123/workflow-states` },
  'update-settings': { href: `${API}/hubs/hub123/settings` },
  'create-content-type-schema': { href: `${API}/hubs/hub123/content-type-schemas` },
  'register-content-type': { href: `${API}/hubs/hub123/content-types` },
  'create-extension': { href: `${API}/hubs/hub123/extensions` },
  'create-webhook': { href: `${API}/hubs/hub123/webhooks` },
}

type Route = [string, { status: number; body?: unknown }]

/**
 * Build a FetchJson stub from a URL → response table (first match wins).
 *
 * A route matches the URL exactly, or as a path/query prefix — so
 * `…/hubs/hub123` also serves `…/hubs/hub123/webhooks?size=1`, but
 * `…/content-repositories/repoS` does *not* swallow `…/repoSC`. Without that
 * boundary, adding a repo whose ID extends another's would silently answer
 * from the wrong route.
 */
function stubFetch(routes: Route[]): FetchJson {
  const matches = (url: string, prefix: string): boolean =>
    url === prefix || url.startsWith(`${prefix}?`) || url.startsWith(`${prefix}/`)
  return (url) => {
    const match = routes.find(([prefix]) => matches(url, prefix))
    if (!match) throw new Error(`Unstubbed URL: ${url}`)
    const [, res] = match
    return Promise.resolve({ status: res.status, body: res.body ?? null })
  }
}

/**
 * Replace one route by URL, in place.
 *
 * Overriding by array index couples every test to the exact length and order
 * of `happyRoutes()` — add a probe and the overrides silently land on the
 * wrong entries. Throwing on an unknown URL means a renamed route fails the
 * test that overrides it rather than quietly not overriding anything.
 */
function override(routes: Route[], url: string, res: { status: number; body?: unknown }): Route[] {
  const index = routes.findIndex(([prefix]) => prefix === url)
  if (index === -1) throw new Error(`No route to override for ${url}`)
  routes[index] = [url, res]
  return routes
}

/** Routes for a hub where every read succeeds and every write link is present. */
function happyRoutes(): Route[] {
  return [
    [`${API}/hubs/hub123/workflow-states`, { status: 200 }],
    [`${API}/hubs/hub123/content-type-schemas`, { status: 200 }],
    [`${API}/hubs/hub123/content-types`, { status: 200 }],
    [`${API}/hubs/hub123/extensions`, { status: 200 }],
    [`${API}/hubs/hub123/webhooks`, { status: 200 }],
    [`${API}/hubs/hub123`, { status: 200, body: { _links: FULL_HUB_LINKS } }],
    [
      `${API}/content-repositories/repoC`,
      { status: 200, body: { _links: { 'create-content-item': { href: 'x' } } } },
    ],
    [
      `${API}/content-repositories/repoS`,
      { status: 200, body: { _links: { 'create-content-item': { href: 'x' } } } },
    ],
  ]
}

function check(report: Awaited<ReturnType<typeof buildPermissionsReport>>, key: string) {
  const found = report.checks.find((c) => c.key === key)
  if (!found) throw new Error(`Check "${key}" missing from report`)
  return found
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('readState', () => {
  it('maps 2xx to ok', () => {
    expect(readState(200)).toBe('ok')
    expect(readState(204)).toBe('ok')
  })

  it('maps 401 and 403 to denied', () => {
    expect(readState(401)).toBe('denied')
    expect(readState(403)).toBe('denied')
  })

  it('maps anything else to error', () => {
    expect(readState(404)).toBe('error')
    expect(readState(500)).toBe('error')
  })
})

describe('writeState', () => {
  it('is ok when the action link is advertised', () => {
    expect(writeState({ 'create-extension': { href: 'x' } }, 'create-extension')).toBe('ok')
  })

  it('is denied when the resource was served without the link', () => {
    expect(writeState({}, 'create-extension')).toBe('denied')
  })

  it('is unknown when no links were available at all', () => {
    expect(writeState(undefined, 'create-extension')).toBe('unknown')
  })
})

describe('extractLinks', () => {
  it('returns the _links object when present', () => {
    expect(extractLinks({ _links: { self: { href: 'x' } } })).toEqual({ self: { href: 'x' } })
  })

  it('returns undefined for bodies without usable _links', () => {
    expect(extractLinks(null)).toBeUndefined()
    expect(extractLinks('nope')).toBeUndefined()
    expect(extractLinks({})).toBeUndefined()
    expect(extractLinks({ _links: null })).toBeUndefined()
  })
})

describe('combinedWriteState', () => {
  it('requires every rel to be present', () => {
    const links: HalLinks = { a: { href: 'x' } }
    expect(combinedWriteState(links, ['a'])).toEqual({ state: 'ok', missing: [] })
    expect(combinedWriteState(links, ['a', 'b'])).toEqual({ state: 'denied', missing: ['b'] })
  })

  it('is unknown without links', () => {
    expect(combinedWriteState(undefined, ['a'])).toEqual({ state: 'unknown', missing: [] })
  })
})

// ── Report builder ────────────────────────────────────────────────────────────

describe('buildPermissionsReport', () => {
  it('reports full capability on the happy path', async () => {
    const report = await buildPermissionsReport(ENV, stubFetch(happyRoutes()))

    expect(report.hub).toEqual({ id: 'hub123', readable: true })
    for (const key of ['settings', 'schemas', 'types', 'extensions', 'webhooks']) {
      expect(check(report, key)).toMatchObject({ read: 'ok', write: 'ok' })
    }
    expect(check(report, 'items-content')).toMatchObject({ read: 'ok', write: 'ok' })
    expect(check(report, 'items-slots')).toMatchObject({ read: 'ok', write: 'ok' })
  })

  it('skips everything when the hub itself is unreadable', async () => {
    const report = await buildPermissionsReport(
      ENV,
      stubFetch([[`${API}/hubs/hub123`, { status: 403 }]]),
    )
    expect(report.hub.readable).toBe(false)
    expect(report.hub.detail).toContain('HTTP 403')
    expect(report.checks).toHaveLength(0)
  })

  it('marks hub-level writes denied and names the missing links', async () => {
    // Hub served, but only the schema-creation link is advertised.
    const routes = override(happyRoutes(), `${API}/hubs/hub123`, {
      status: 200,
      body: { _links: { 'create-content-type-schema': { href: 'x' } } },
    })
    const report = await buildPermissionsReport(ENV, stubFetch(routes))

    expect(check(report, 'schemas')).toMatchObject({ read: 'ok', write: 'ok' })
    expect(check(report, 'types')).toMatchObject({ write: 'denied' })
    expect(check(report, 'types').detail).toContain('register-content-type')
    expect(check(report, 'settings')).toMatchObject({ write: 'denied' })
    expect(check(report, 'settings').detail).toContain('create-workflow-state')
    expect(check(report, 'settings').detail).toContain('update-settings')
  })

  it('treats a hub body without _links as unknown writes', async () => {
    const routes = override(happyRoutes(), `${API}/hubs/hub123`, { status: 200, body: {} })
    const report = await buildPermissionsReport(ENV, stubFetch(routes))
    expect(check(report, 'schemas')).toMatchObject({ read: 'ok', write: 'unknown' })
  })

  it('marks denied read probes with their status', async () => {
    const routes = override(happyRoutes(), `${API}/hubs/hub123/content-type-schemas`, {
      status: 403,
    })
    const report = await buildPermissionsReport(ENV, stubFetch(routes))
    const schemas = check(report, 'schemas')
    expect(schemas.read).toBe('denied')
    expect(schemas.detail).toContain('HTTP 403')
  })

  it('flags a 404 repo as a likely-wrong ID', async () => {
    const routes = override(happyRoutes(), `${API}/content-repositories/repoC`, { status: 404 })
    const report = await buildPermissionsReport(ENV, stubFetch(routes))
    const items = check(report, 'items-content')
    expect(items.read).toBe('error')
    expect(items.write).toBe('unknown')
    expect(items.detail).toContain('check the repository ID')
  })

  it('marks a readable repo without create-content-item as write-denied', async () => {
    const routes = override(happyRoutes(), `${API}/content-repositories/repoS`, {
      status: 200,
      body: { _links: {} },
    })
    const report = await buildPermissionsReport(ENV, stubFetch(routes))
    const items = check(report, 'items-slots')
    expect(items).toMatchObject({ read: 'ok', write: 'denied' })
    expect(items.detail).toContain('create-content-item')
  })

  it('skips repos that are not configured', async () => {
    const report = await buildPermissionsReport(ENV, stubFetch(happyRoutes()))
    expect(check(report, 'items-site-components')).toMatchObject({
      read: 'skipped',
      write: 'skipped',
      detail: 'not configured',
    })
  })

  it('checks the site components repo when configured', async () => {
    const routes = happyRoutes()
    routes.push([
      `${API}/content-repositories/repoSC`,
      { status: 200, body: { _links: { 'create-content-item': { href: 'x' } } } },
    ])
    const report = await buildPermissionsReport(
      { ...ENV, repoSiteComponents: 'repoSC' },
      stubFetch(routes),
    )
    expect(check(report, 'items-site-components')).toMatchObject({ read: 'ok', write: 'ok' })
  })

  it('stamps checkedAt with an ISO timestamp', async () => {
    const report = await buildPermissionsReport(ENV, stubFetch(happyRoutes()))
    expect(new Date(report.checkedAt).toISOString()).toBe(report.checkedAt)
  })
})
