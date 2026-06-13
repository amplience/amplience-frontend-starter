// Route-level tests for /visualization (QL-43 follow-on).
//
// The route builds a per-request SDK client pinned to the `vse` param, so
// the tests swap `makeSdkContentClient` for a fixtures-backed double and
// capture the config it was built with — asserting both the rendering
// behaviour and that the VSE override actually reaches the client. Node
// environment — the page is a Server Component; assertions run against
// react-dom/server markup, the same SSR path Next exercises.

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContentClient } from '@amplience/quadratic-content'

let sdkConfigs: unknown[] = []
let stubClient: ContentClient | undefined

vi.mock('@amplience/quadratic-content/sdk', async () => {
  const { makeMockContentClient, makeFailingContentClient } =
    await import('@amplience/quadratic-content/mock')
  return {
    makeSdkContentClient: (config: unknown) => {
      sdkConfigs.push(config)
      return (
        stubClient ??
        // Default double: fixtures by id, same port semantics as the SDK.
        makeMockContentClient()
      )
    },
    __failing: makeFailingContentClient,
  }
})

const loadRoute = async () => {
  vi.resetModules()
  return import('./page')
}

const routeProps = (params: Record<string, string | string[]>) => ({
  searchParams: Promise.resolve(params),
})

const VSE = 'g8tgyy0etx3f1hv243pqc24ci.staging.bigcontent.io'
/** The home hero fixture's id — a real, resolvable delivery ID. */
const HERO_ID = 'a1b2c3d4-0001-4000-8000-000000000003'

const render = async (params: Record<string, string | string[]>) => {
  const route = await loadRoute()
  return renderToStaticMarkup(await route.default(routeProps(params)))
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  sdkConfigs = []
  stubClient = undefined
  vi.restoreAllMocks()
})

describe('Visualization — happy path', () => {
  it('renders the requested item through the registry', async () => {
    const markup = await render({ vse: VSE, content: HERO_ID })
    // Structure, not copy — fixture text is editable content. A rendered
    // hero means dispatch succeeded and no failure card took its place.
    expect(markup).toContain('<h1')
    expect(markup).not.toContain('data-renderer-failure')
  })

  it('pins the per-request client to the vse host', async () => {
    await render({ vse: VSE, content: HERO_ID })
    expect(sdkConfigs).toHaveLength(1)
    expect(sdkConfigs[0]).toMatchObject({ stagingHost: VSE })
  })

  it('is force-dynamic and noindex', async () => {
    const route = await loadRoute()
    expect(route.dynamic).toBe('force-dynamic')
    expect(route.metadata.robots).toEqual({ index: false, follow: false })
  })
})

describe('Visualization — parameter validation', () => {
  const expectMisconfigured = (markup: string) => {
    expect(markup).toContain('visualization-misconfigured')
    expect(markup).toContain('vse={{vse.domain}}')
  }

  it('explains when params are missing entirely', async () => {
    expectMisconfigured(await render({}))
    expectMisconfigured(await render({ vse: VSE }))
    expectMisconfigured(await render({ content: HERO_ID }))
    expect(sdkConfigs).toHaveLength(0)
  })

  it('rejects repeated params', async () => {
    expectMisconfigured(await render({ vse: [VSE, VSE], content: HERO_ID }))
  })

  it('rejects vse hosts outside the staging suffix', async () => {
    expectMisconfigured(await render({ vse: 'evil.example.com', content: HERO_ID }))
  })

  it('rejects vse values that could escape the host position', async () => {
    for (const vse of [
      `nope.com/${VSE}`,
      `${VSE}/path`,
      `${VSE}:8080`,
      `user@${VSE}`,
      `${VSE}?x=1`,
    ]) {
      expectMisconfigured(await render({ vse, content: HERO_ID }))
    }
    expect(sdkConfigs).toHaveLength(0)
  })

  it('rejects content ids that are not delivery UUIDs', async () => {
    expectMisconfigured(await render({ vse: VSE, content: 'homepage' }))
    expectMisconfigured(await render({ vse: VSE, content: 'z'.repeat(36) }))
  })
})

describe('Visualization — content failures stay loud', () => {
  it('renders the ContentUnavailable card for an unknown id', async () => {
    const markup = await render({ vse: VSE, content: '00000000-0000-4000-8000-000000000000' })
    expect(markup).toContain('data-renderer-failure')
    expect(markup).toContain('00000000-0000-4000-8000-000000000000')
  })

  it('renders the ContentUnavailable card when the client fails', async () => {
    const { makeFailingContentClient } = await import('@amplience/quadratic-content/mock')
    stubClient = makeFailingContentClient('network')
    const markup = await render({ vse: VSE, content: HERO_ID })
    expect(markup).toContain('data-renderer-failure')
  })
})
