// Locale-middleware unit tests (ADR-0015).
//
// The middleware is called directly with a NextRequest and its decision read
// off the response's control headers: `NextResponse.rewrite` sets
// `x-middleware-rewrite` to the internal URL; `NextResponse.next` sets
// `x-middleware-next`. The test environment resolves the zero-config default
// locale (en-US → slug `en-us`), so unprefixed paths rewrite under `/en-us`.

import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { middleware } from './middleware'

const run = (path: string) => middleware(new NextRequest(new URL(`http://localhost${path}`)))

const rewrittenPath = (path: string): string | null => {
  const header = run(path).headers.get('x-middleware-rewrite')
  return header === null ? null : new URL(header).pathname
}

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

  it('redirects a non-canonical locale casing to the lowercase form', () => {
    const res = run('/EN-US/about')
    expect(res.status).toBe(308)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-us/about')
  })

  it('redirects a mixed-case locale at the root', () => {
    const res = run('/En-Us')
    expect(res.status).toBe(308)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-us')
  })

  it('treats an unconfigured locale-looking prefix as content, not a locale', () => {
    // `fr-fr` is not configured in the zero-config default, so it is a normal
    // path segment and the whole path rewrites under the default locale.
    expect(rewrittenPath('/fr-fr/about')).toBe('/en-us/fr-fr/about')
  })
})
