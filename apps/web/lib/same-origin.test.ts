import { describe, expect, it } from 'vitest'

import { sameOriginUrl } from './same-origin'

const requestFor = (href: string) => {
  const url = new URL(href)
  return { nextUrl: { clone: () => new URL(url), origin: url.origin } }
}

describe('sameOriginUrl', () => {
  it('keeps the origin and query, replacing the path', () => {
    const url = sameOriginUrl(requestFor('https://site.example/EN-US/x?y=1'), '/en-us/x')
    expect(url.href).toBe('https://site.example/en-us/x?y=1')
  })

  it.each([
    ['//evil.example/x', '/evil.example/x'],
    ['/en-us//evil.example', '/en-us/evil.example'],
    ['/\\evil.example', '/evil.example'],
    ['/a///b/', '/a/b/'],
  ])('collapses %s to %s', (input, expected) => {
    const url = sameOriginUrl(requestFor('https://site.example/'), input)
    expect(url.origin).toBe('https://site.example')
    expect(url.pathname).toBe(expected)
  })

  it('refuses a target on another origin', () => {
    const request = {
      nextUrl: { clone: () => new URL('https://evil.example/'), origin: 'https://site.example' },
    }
    expect(() => sameOriginUrl(request, '/x')).toThrow(/Refusing to route/)
  })
})
