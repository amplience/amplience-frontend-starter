// Route-level content-failure tests for the home page (QL-37).
//
// The route builds its client via `makeMockContentClient`, so the tests swap
// that factory for `makeFailingContentClient` per error kind and re-import
// the route module fresh each time (the client is created at module scope).
// Node environment — the page is a Server Component; assertions run against
// react-dom/server markup, the same SSR path Next exercises.

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContentClientErrorKind } from '@amplience/quadratic-content'

let failKind: ContentClientErrorKind | undefined

vi.mock('@amplience/quadratic-content/mock', async (importOriginal) => {
  const original = await importOriginal<typeof import('@amplience/quadratic-content/mock')>()
  return {
    ...original,
    makeMockContentClient: () =>
      failKind === undefined
        ? original.makeMockContentClient()
        : original.makeFailingContentClient(failKind),
  }
})

const loadRoute = async () => {
  vi.resetModules()
  return import('./page')
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  failKind = undefined
  vi.restoreAllMocks()
})

describe('HomePage — content-fetch failures', () => {
  it.each(['network', 'unauthorised', 'malformed', 'unknown'] as const)(
    'renders a visible ContentUnavailable card when the fetch fails with "%s"',
    async (kind) => {
      failKind = kind
      const { default: HomePage } = await loadRoute()
      const out = renderToStaticMarkup((await HomePage()) as ReactNode)
      expect(out).toContain('data-renderer-failure="ContentUnavailable"')
      expect(out).toContain('role="alert"')
      // Structured console signal emitted alongside the card.
      expect(console.error).toHaveBeenCalled()
    },
  )

  it('throws to the 404 boundary when the page item does not exist', async () => {
    failKind = 'not-found'
    const { default: HomePage } = await loadRoute()
    // notFound() throws Next's control-flow error; the route must not
    // swallow it into a card.
    await expect(HomePage()).rejects.toThrowError()
  })

  it('falls back to layout metadata when the metadata fetch fails', async () => {
    failKind = 'network'
    const { generateMetadata } = await loadRoute()
    await expect(generateMetadata()).resolves.toEqual({})
  })

  it('still renders the full page tree when the client is healthy', async () => {
    const { default: HomePage } = await loadRoute()
    const out = renderToStaticMarkup((await HomePage()) as ReactNode)
    expect(out).toContain('data-page')
    expect(out).toContain('data-slot')
    expect(out).not.toContain('data-renderer-failure')
  })
})
