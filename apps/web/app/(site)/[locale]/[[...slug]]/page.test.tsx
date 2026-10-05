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

import { PAGE_SCHEMA } from '@amplience/frontend-starter-components/registry'
import { ContentClientError } from '@amplience/frontend-starter-content'
import type { ContentClient, ContentClientErrorKind } from '@amplience/frontend-starter-content'

let failKind: ContentClientErrorKind | undefined
let stubClient: ContentClient | undefined

vi.mock('@amplience/frontend-starter-content/mock', async (importOriginal) => {
  const original = await importOriginal<typeof import('@amplience/frontend-starter-content/mock')>()
  return {
    ...original,
    // Forward the set name so FIXTURE_SET (via lib/content-client) still selects it.
    makeMockContentClient: (setName?: string) =>
      stubClient ??
      (failKind === undefined
        ? original.makeMockContentClient(setName)
        : original.makeFailingContentClient(failKind)),
  }
})

/** A ContentClient whose every call resolves/rejects with the given impl. */
const makeStubClient = (impl: Partial<ContentClient>): ContentClient => ({
  getByKey: () => Promise.reject(new Error('stub: getByKey not implemented')),
  getById: () => Promise.reject(new Error('stub: getById not implemented')),
  listBySchema: () => Promise.reject(new Error('stub: listBySchema not implemented')),
  getHierarchy: () => Promise.reject(new Error('stub: getHierarchy not implemented')),
  ...impl,
})

const loadRoute = async () => {
  vi.resetModules()
  return import('./page')
}

/**
 * Next.js delivers `params` as a promise. The `[locale]` segment is always
 * present (the middleware guarantees it); tests use the zero-config default
 * locale `en-us`, for which `publicPath` leaves canonicals unprefixed — so
 * the canonical assertions below read as the plain route path. The root path
 * still has no slug.
 */
const routeProps = (slug?: string[]) => ({
  // `exactOptionalPropertyTypes`: omit `slug` entirely at the root, matching
  // what Next actually delivers for an optional catch-all.
  params: Promise.resolve(slug === undefined ? { locale: 'en-us' } : { locale: 'en-us', slug }),
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
    expect(out).toContain('The head for your headless CMS')
    expect(out).not.toContain('data-renderer-failure')
  })

  it('renders the same content for an alias delivery key (about-us)', async () => {
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['about-us']))) as ReactNode)
    expect(out).toContain('The head for your headless CMS')
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
    const meta = await generateMetadata(routeProps(['site', 'footer']))
    expect(meta.robots).toEqual({ index: false, follow: false })
  })

  it('marks non-page items noindex (keyed slot)', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['site', 'header']))
    expect(meta.robots).toEqual({ index: false, follow: false })
  })

  it('throws to the 404 boundary for a reserved key', async () => {
    // Both halves of the route 404 reserved keys — generateMetadata runs
    // before the page body, so it must not fetch furniture either.
    const { generateMetadata } = await loadRoute()
    await expect(generateMetadata(routeProps(['footer']))).rejects.toThrowError()
  })

  it('emits no robots tag for a page that sets none (site default: indexable)', async () => {
    // The on-disk `about` fixture now carries an explicit (if permissive)
    // `robots` group — added so the CMS hub-import UI doesn't flag it as
    // unsaved — so it no longer represents "a page that sets none". Stub a
    // page item with no `robots` field at all to keep testing that case.
    stubClient = makeStubClient({
      getByKey: () => Promise.resolve({ _meta: { schema: PAGE_SCHEMA } } as never),
    })
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

describe('ContentPage — category listings (ADR-0024)', () => {
  // The fixtures put every product in a top-level category and a leaf one,
  // so `/home` exercises ancestor matching and `/home-tables` a leaf.
  // Products live in the anyafinn set (ADR-0019); the default set has none.
  // lib/content-client reads FIXTURE_SET when loadRoute() re-imports it.
  beforeEach(() => {
    vi.stubEnv('FIXTURE_SET', 'anyafinn')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders a category listing for a path with no page behind it', async () => {
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['home-tables']))) as ReactNode)
    expect(out).toContain('data-category="home-tables"')
    // Assert the filtering, not a marker attribute: both tables are in, and
    // a product from a sibling category is out.
    expect(out).toContain('/products/terra-dining-table')
    expect(out).toContain('/products/aurora-side-table')
    expect(out).not.toContain('/products/lumen-floor-lamp')
  })

  it('matches an ancestor category, because ancestors are denormalised', async () => {
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['home']))) as ReactNode)
    expect(out).toContain('data-category="home"')
    // The leaf's products *and* its siblings' — with no tree walk anywhere,
    // because every product carries `home` alongside its leaf category.
    expect(out).toContain('/products/terra-dining-table')
    expect(out).toContain('/products/lumen-floor-lamp')
  })

  it('derives an unlocalised title from the identifier', async () => {
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['mens-shirts']))) as ReactNode)
    expect(out).toContain('Mens Shirts')
  })

  it('still 404s a path that is neither a page nor a category', async () => {
    const { default: ContentPage } = await loadRoute()
    await expect(ContentPage(routeProps(['not-a-category-at-all']))).rejects.toThrowError()
  })

  it('lets a CMS page win over a category of the same name', async () => {
    // The editorial override (ADR-0024 §5). Stubbing the page read to succeed
    // for a slug that is also a real category is the whole assertion.
    stubClient = makeStubClient({
      getByKey: () => Promise.resolve({ _meta: { schema: PAGE_SCHEMA }, slots: [] } as never),
    })
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['home']))) as ReactNode)
    expect(out).not.toContain('data-category=')
  })

  it('gives a category page a derived title and canonical in metadata', async () => {
    const { generateMetadata } = await loadRoute()
    const meta = await generateMetadata(routeProps(['home-tables']))
    expect(meta.title).toBe('Home Tables')
    expect(meta.alternates?.canonical).toBe('/home-tables')
  })
})

describe('ContentPage — a transient failure must never become a 404 (ADR-0024 §6)', () => {
  // The highest-risk line in the change: if a hub outage fell through the
  // category branch to notFound(), a five-minute blip would be answered with
  // 404s that crawlers act on and CDNs cache.

  it.each(['network', 'unauthorised', 'malformed', 'unknown'] as const)(
    'shows the failure card rather than 404ing on "%s" at a category path',
    async (kind) => {
      failKind = kind
      const { default: ContentPage } = await loadRoute()
      const out = renderToStaticMarkup((await ContentPage(routeProps(['home']))) as ReactNode)
      expect(out).toContain('data-renderer-failure="ContentUnavailable"')
    },
  )

  it('shows the failure card when the page is absent but categories cannot be read', async () => {
    // The page genuinely 404s; the category lookup then fails. That is not
    // knowledge that the URL will never exist, so it must not be a 404.
    stubClient = makeStubClient({
      getByKey: () => Promise.reject(new ContentClientError('not-found', 'gone')),
      listBySchema: () => Promise.reject(new ContentClientError('network', 'hub unreachable')),
    })
    const { default: ContentPage } = await loadRoute()
    const out = renderToStaticMarkup((await ContentPage(routeProps(['home']))) as ReactNode)
    expect(out).toContain('data-renderer-failure="ContentUnavailable"')
  })

  it('treats not-found from the category list as an empty set, not a failure', async () => {
    // `not-found` from a *list* means nothing matched, never that the service
    // is broken — so it degrades to 404 rather than to a card.
    stubClient = makeStubClient({
      getByKey: () => Promise.reject(new ContentClientError('not-found', 'gone')),
      listBySchema: () => Promise.reject(new ContentClientError('not-found', 'nothing')),
    })
    const { default: ContentPage } = await loadRoute()
    await expect(ContentPage(routeProps(['home']))).rejects.toThrowError()
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
