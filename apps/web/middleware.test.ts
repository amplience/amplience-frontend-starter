// Locale-middleware unit tests (ADR-0015).
//
// The middleware is called directly with a NextRequest and its decision read
// off the response's control headers: `NextResponse.rewrite` sets
// `x-middleware-rewrite` to the internal URL; `NextResponse.next` sets
// `x-middleware-next`. The test environment resolves the zero-config default
// locale (en-US → slug `en-us`), so unprefixed paths rewrite under `/en-us`.

import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { config, middleware } from './middleware'

const run = (path: string, init?: { headers?: Record<string, string> }) =>
  middleware(new NextRequest(new URL(`http://localhost${path}`), init))

const rewrittenPath = (path: string): string | null => {
  const header = run(path).headers.get('x-middleware-rewrite')
  return header === null ? null : new URL(header).pathname
}

// A request-header override set via `NextResponse.next/rewrite({ request })` is
// encoded on the response as `x-middleware-request-<name>`.
const forwardedLocale = (path: string): string | null =>
  run(path).headers.get('x-middleware-request-x-locale')

describe('locale middleware', () => {
  it('rewrites an unprefixed path to the default locale', () => {
    expect(rewrittenPath('/about')).toBe('/en-us/about')
  })

  it('rewrites the root to the default locale with no trailing slash', () => {
    expect(rewrittenPath('/')).toBe('/en-us')
  })

  it('rewrites a nested unprefixed path', () => {
    expect(rewrittenPath('/blog/hello-world')).toBe('/en-us/blog/hello-world')
  })

  it('passes an explicit, configured locale prefix through untouched', () => {
    const res = run('/en-us/about')
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  // Served in place rather than redirected — see the Option 1/2 note in middleware.ts.
  it('serves a non-canonical locale casing as the lowercase page', () => {
    expect(rewrittenPath('/EN-US/about')).toBe('/en-us/about')
    expect(forwardedLocale('/EN-US/about')).toBe('en-us')
    expect(run('/EN-US/about').headers.get('location')).toBeNull()
  })

  it('serves a mixed-case locale at the root as the lowercase root', () => {
    expect(rewrittenPath('/En-Us')).toBe('/en-us')
  })

  it('treats an unconfigured locale-looking prefix as content, not a locale', () => {
    // `fr-fr` is not configured in the zero-config default, so it is a normal
    // path segment and the whole path rewrites under the default locale.
    expect(rewrittenPath('/fr-fr/about')).toBe('/en-us/fr-fr/about')
  })

  it('forwards the default locale as x-locale on an unprefixed rewrite', () => {
    // `not-found.tsx` has no params; this header is its only locale signal.
    expect(forwardedLocale('/about')).toBe('en-us')
  })

  it('forwards the resolved locale as x-locale on a passthrough', () => {
    expect(forwardedLocale('/en-us/about')).toBe('en-us')
  })
})

// The cases above call the middleware directly, so they never exercise the
// matcher — which decides whether it runs at all.
describe('locale middleware matcher', () => {
  const matches = (path: string) =>
    unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` })

  it.each(['/', '/about', '/blog/hello-world', '/en-us/about', '/apiary', '/visualize-this'])(
    'runs on the content path %s',
    (path) => {
      expect(matches(path)).toBe(true)
    },
  )

  it.each([
    '/api/products?skus=AF-1',
    '/api/revalidate-custom-css',
    '/visualization?vse=x&content=y',
    '/debug',
    '/_next/static/chunk.js',
    '/.well-known/security.txt',
    '/favicon.ico',
  ])('skips the non-content path %s', (path) => {
    expect(matches(path)).toBe(false)
  })
})

describe('preview routing', () => {
  const HOST = 'abc-gvzrfgnzc-1794568891000.staging.bigcontent.io'
  const forwardedHost = (path: string, init?: { headers?: Record<string, string> }) =>
    run(path, init).headers.get('x-middleware-request-x-preview-vse')

  it.each([
    [`/preview/${HOST}`, '/en-us'],
    [`/preview/${HOST}/about`, '/en-us/about'],
    [`/preview/${HOST}/en-us/about`, '/en-us/about'],
    [`/preview/${HOST}/blog/hello`, '/en-us/blog/hello'],
  ])('rewrites %s to %s', (path, target) => {
    expect(rewrittenPath(path)).toBe(target)
  })

  it('forwards the validated host and the locale', () => {
    expect(forwardedHost(`/preview/${HOST}/about`)).toBe(HOST)
    expect(forwardedLocale(`/preview/${HOST}/about`)).toBe('en-us')
  })

  it('serves a mis-cased locale inside a preview', () => {
    expect(rewrittenPath(`/preview/${HOST}/EN-US/about`)).toBe('/en-us/about')
    expect(forwardedHost(`/preview/${HOST}/EN-US/about`)).toBe(HOST)
  })

  it('marks preview responses noindex and no-referrer', () => {
    const res = run(`/preview/${HOST}/about`)
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('treats a bad host as an ordinary content path', () => {
    expect(rewrittenPath('/preview/example.com/about')).toBe('/en-us/preview/example.com/about')
    expect(forwardedHost('/preview/example.com/about')).toBeNull()
    expect(run('/preview/example.com/about').headers.get('x-robots-tag')).toBeNull()
  })

  it.each(['/about', '/en-us/about'])('strips a spoofed preview header on %s', (path) => {
    const res = run(path, { headers: { 'x-preview-vse': HOST } })
    expect(res.headers.get('x-middleware-request-x-preview-vse')).toBeNull()
    expect(res.headers.get('x-middleware-override-headers')).not.toContain('x-preview-vse')
  })

  it('matches preview URLs despite the dots in the host', () => {
    expect(
      unstable_doesMiddlewareMatch({ config, url: `http://localhost/preview/${HOST}/about` }),
    ).toBe(true)
  })
})

describe('redirect and rewrite targets stay on this origin', () => {
  it.each([
    '//evil.example/x',
    '/about//evil.example',
    '/EN-US//evil.example/x',
    '/EN-US/\\evil.example/x',
  ])('a rewrite of %s stays on localhost', (path) => {
    const header = run(path).headers.get('x-middleware-rewrite') ?? ''
    expect(new URL(header).origin).toBe('http://localhost')
    expect(new URL(header).pathname).not.toContain('//')
  })
})
