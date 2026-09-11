// Route-level tests for the localized branded 404 (QL-37, ADR-0015).
//
// The boundary fetches the `${siteName}/site/not-found` slot through
// `lib/content-client` (the mock, since no CONTENT_CLIENT env is set in tests)
// and reads the active locale from the `x-locale` request header — which
// `not-found.tsx` gets via `headers()`, not from params. Both are mocked here:
// `next/headers` for the locale, and the mock-client factory for the failure
// path. The module composes its client at import scope, so each case
// re-imports the route fresh (mirrors the catch-all route's tests).

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContentClient } from '@amplience/frontend-starter-content'

const state = vi.hoisted((): { locale: string | null; stubClient: ContentClient | undefined } => ({
  // The value the mocked `headers()` returns for `x-locale` (null = unset).
  locale: 'en-us',
  // When set, the mock-client factory returns this instead of the real mock.
  stubClient: undefined,
}))

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve(new Headers(state.locale === null ? {} : { 'x-locale': state.locale })),
}))

vi.mock('@amplience/frontend-starter-content/mock', async (importOriginal) => {
  const original = await importOriginal<typeof import('@amplience/frontend-starter-content/mock')>()
  return {
    ...original,
    makeMockContentClient: () => state.stubClient ?? original.makeMockContentClient(),
  }
})

const loadRoute = async () => {
  vi.resetModules()
  return import('./not-found')
}

const render = async () => {
  const { default: NotFound } = await loadRoute()
  return renderToStaticMarkup((await NotFound()) as ReactNode)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  state.locale = 'en-us'
  state.stubClient = undefined
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('localized 404 — editable content by delivery key', () => {
  it('renders the seeded not-found slot content at the default locale', async () => {
    const out = await render()
    expect(out).toContain('Page not found')
    expect(out).toContain('Back to the home page')
    expect(out).not.toContain('data-renderer-failure')
  })

  it('renders the content localized to the active locale from x-locale', async () => {
    // Configure de-DE for this case (the zero-config default is en-US only);
    // the fresh re-import in `loadRoute` picks the env up.
    vi.stubEnv('AMPLIENCE_LOCALES', 'en-US,de-DE')
    state.locale = 'de-de'
    const out = await render()
    // German subtitle from the fixture proves the fetch carried the locale
    // and the client collapsed the localized fields to it.
    expect(out).toContain('Unter dieser Adresse gibt es keinen Inhalt')
  })

  it('falls back to the default locale when the x-locale header is absent', async () => {
    state.locale = null
    const out = await render()
    expect(out).toContain('Page not found')
  })
})

describe('localized 404 — resilient fallback', () => {
  it('renders the hardcoded fallback when the content fetch fails', async () => {
    // A 404 often fires because the hub is unreachable, so the 404 body's own
    // fetch fails too — the boundary must still render a complete page.
    state.stubClient = {
      getByKey: () => Promise.reject(new Error('hub unreachable')),
      getById: () => Promise.reject(new Error('unused')),
      listBySchema: () => Promise.reject(new Error('unused')),
      getHierarchy: () => Promise.reject(new Error('unused')),
    }
    const out = await render()
    expect(out).toContain('Page not found')
    expect(out).toContain('Back to the home page')
    expect(out).not.toContain('data-renderer-failure')
  })
})
