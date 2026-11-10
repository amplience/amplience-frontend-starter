import { beforeEach, describe, expect, it, vi } from 'vitest'

const { request } = vi.hoisted(() => ({
  request: { headers: undefined as Record<string, string> | undefined },
}))

// `undefined` headers = called outside a request, where `headers()` throws.
vi.mock('next/headers', () => ({
  headers: () => {
    if (request.headers === undefined) throw new Error('outside a request scope')
    return Promise.resolve(new Headers(request.headers))
  },
}))

const { getPreviewHost, siteBasePath } = await import('./preview-request')

const HOST = 'abc-gvzrfgnzc-1794568891000.staging.bigcontent.io'
const EN = { code: 'en-US', slug: 'en-us', delivery: 'en-US,*' }

beforeEach(() => {
  request.headers = {}
})

describe('getPreviewHost', () => {
  it('reads the forwarded host', async () => {
    request.headers = { 'x-preview-vse': HOST }
    expect(await getPreviewHost()).toBe(HOST)
  })

  it('is undefined on the live site', async () => {
    expect(await getPreviewHost()).toBeUndefined()
  })

  it('is undefined outside a request', async () => {
    request.headers = undefined
    expect(await getPreviewHost()).toBeUndefined()
  })

  it('ignores a value that is not a staging host', async () => {
    request.headers = { 'x-preview-vse': 'example.com' }
    expect(await getPreviewHost()).toBeUndefined()
  })
})

describe('siteBasePath', () => {
  it('is the locale base on the live site', async () => {
    expect(await siteBasePath(EN)).toBe('')
  })

  it('carries the preview prefix inside a preview', async () => {
    request.headers = { 'x-preview-vse': HOST }
    expect(await siteBasePath(EN)).toBe(`/preview/${HOST}`)
  })
})
