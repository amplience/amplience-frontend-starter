// Route-level tests for the catch-all content route (QL-37, QL-76).
//
// The route's client comes from `lib/content-client`, which resolves to
// `makeMockContentClient` when no CONTENT_CLIENT env is set (always true in
// tests) — so the failure tests swap that factory for
// `makeFailingContentClient` per error kind and re-import the route module
// fresh each time (the client is composed at module scope). Node
// environment — the page is a Server Component;
// assertions run against react-dom/server markup, the same SSR path Next
// exercises.

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContentClient, ContentClientErrorKind } from '@amplience/quadratic-content'

let failKind: ContentClientErrorKind | undefined
let stubClient: ContentClient | undefined

vi.mock('@amplience/quadratic-content/mock', async (importOriginal) => {
  const original = await importOriginal<typeof import('@amplience/quadratic-content/mock')>()
  return {
    ...original,
    makeMockContentClient: () =>
      stubClient ??
      (failKind === undefined
        ? original.makeMockContentClient()
        : original.makeFailingContentClient(failKind)),
  }
})

/** A ContentClient whose every call resolves/rejects with the given impl. */
const makeStubClient = (impl: Partial<ContentClient>): ContentClient => ({
  getByKey: () => Promise.reject(new Error('stub: getByKey not implemented')),
  getById: () => Promise.reject(new Error('stub: getById not implemented')),
  ...impl,
})

const loadRoute = async () => {
  vi.resetModules()
  return import('./page')
}

/** Next.js delivers `params` as a promise; the root path has no slug. */
const routeProps = (slug?: string[]) => ({
  // `exactOptionalPropertyTypes`: omit the property entirely at the root,
  // matching what Next actually delivers for an optional catch-all.
  params: Promise.resolve(slug === undefined ? {} : { slug }),
})

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  failKind = undefined
  stubClient = undefined
  vi.restoreAllMocks()
})

describe('ContentPage — path → delivery key routing (QL-76)', () => {
  it('renders the homepage at the root path', async () => {
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps())) as ReactNode)
    expect(out).toContain('data-page')
    expect(out).toContain('data-slot')
    expect(out).not.toContain('data-renderer-failure')
  })

  it('renders the about page server-side at /about', async () => {
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['about']))) as ReactNode)
    expect(out).toContain('data-page')
    expect(out).toContain('The head for your headless CMS.')
    expect(out).not.toContain('data-renderer-failure')
  })

  it('renders the same content for an alias delivery key (about-us)', async () => {
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['about-us']))) as ReactNode)
    expect(out).toContain('The head for your headless CMS.')
  })

  it('throws to the 404 boundary for a reserved key (site furniture)', async () => {
    const { default: ContentPage } = await loadRoute()
    await expect(ContentPage(routeProps(['header']))).rejects.toThrowError()
  })

  it('throws to the 404 boundary for an unknown slug', async () => {
    const { default: ContentPage } = await loadRoute()
    await expect(ContentPage(routeProps(['no-such-page']))).rejects.toThrowError()
  })
})

describe('ContentPage — metadata (QL-76)', () => {
  it('defaults the canonical to the route path', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['docs']))
    expect(meta.alternates?.canonical).toBe('/docs')
    expect(meta.title).toBe('Documentation')
  })

  it('uses "/" as the canonical path for the homepage', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps())
    expect(meta.alternates?.canonical).toBe('/')
  })

  it('lets content-set canonicalUrl win for alias keys', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['about-us']))
    expect(meta.alternates?.canonical).toBe('/about')
  })

  it('marks non-page items noindex (keyed component fragment)', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['about', 'hero']))
    expect(meta.robots).toEqual({ index: false, follow: false })
  })

  it('marks non-page items noindex (keyed slot)', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['docs', 'main']))
    expect(meta.robots).toEqual({ index: false, follow: false })
  })

  it('throws to the 404 boundary for a reserved key', async () => {
    // Both halves of the route 404 reserved keys — generateMetadata runs
    // before the page body, so it must not fetch furniture either.
    const { generateMetadata } = await loadRoute()
    await expect(generateMetadata(routeProps(['footer']))).rejects.toThrowError()
  })

  it('emits no robots tag for a page that sets none (site default: indexable)', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['about']))
    expect(meta.robots).toBeUndefined()
  })
})

describe('ContentPage — content-fetch failures (QL-37)', () => {
  it.each(['network', 'unauthorised', 'malformed', 'unknown'] as const)(
    'renders a visible ContentUnavailable card when the fetch fails with "%s"',
    async (kind) => {
      failKind = kind
      const { default: ContentPage } = await loadRoute()
      const out = renderToStaticMarkup((await ContentPage(routeProps())) as ReactNode)
      expect(out).toContain('data-renderer-failure="ContentUnavailable"')
      expect(out).toContain('role="alert"')
      // Structured console signal emitted alongside the card.
      expect(console.error).toHaveBeenCalled()
    },
  )

  it('throws to the 404 boundary when the page item does not exist', async () => {
    failKind = 'not-found'
    const { default: ContentPage } = await loadRoute()
    // notFound() throws Next's control-flow error; the route must not
    // swallow it into a card.
    await expect(ContentPage(routeProps())).rejects.toThrowError()
  })

  it('falls back to layout metadata when the metadata fetch fails', async () => {
    failKind = 'network'
    const { generateMetadata } = await loadRoute()
    await expect(generateMetadata(routeProps())).resolves.toEqual({})
  })
})

describe('ContentPage — unexpected (non-content) errors', () => {
  // Anything that isn't a ContentClientError must escape to app/error.tsx,
  // not be swallowed into a card or an empty metadata object.

  it('rethrows from the page body', async () => {
    stubClient = makeStubClient({
      getByKey: () => Promise.reject(new TypeError('exploded in transit')),
    })
    const { default: ContentPage } = await loadRoute()
    await expect(ContentPage(routeProps())).rejects.toThrowError('exploded in transit')
  })

  it('rethrows from generateMetadata', async () => {
    stubClient = makeStubClient({
      getByKey: () => Promise.reject(new TypeError('exploded in transit')),
    })
    const { generateMetadata } = await loadRoute()
    await expect(generateMetadata(routeProps())).rejects.toThrowError('exploded in transit')
  })

  it('treats an item with no _meta as a non-page (noindex)', async () => {
    // A malformed body shouldn't crash metadata mapping — and it certainly
    // isn't a page, so it stays out of the index.
    stubClient = makeStubClient({
      getByKey: () => Promise.resolve({} as never),
    })
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['weird-item']))
    expect(meta.robots).toEqual({ index: false, follow: false })
  })
})
