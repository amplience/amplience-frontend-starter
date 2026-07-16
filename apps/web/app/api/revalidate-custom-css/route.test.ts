/**
 * Custom-CSS revalidation endpoint (POST).
 *
 * Contract: inert (501) when no secret is configured; 401 on a missing/wrong
 * secret; on a correct secret (header or query) it clears the custom-CSS cache
 * tag and reports success. The secret is read at module load, so each case
 * re-imports the route under a stubbed env.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidateTag }))
vi.mock('../../../lib/custom-css', () => ({ CUSTOM_CSS_TAG: 'amplience-custom-css' }))

// '' models "not configured" — the route treats an empty secret as unset.
async function loadRoute(secret: string) {
  vi.resetModules()
  vi.stubEnv('AMPLIENCE_REVALIDATE_SECRET', secret)
  return import('./route')
}

const post = (opts: { header?: string; query?: string } = {}) => {
  const url = opts.query
    ? `http://localhost/api/revalidate-custom-css?secret=${opts.query}`
    : 'http://localhost/api/revalidate-custom-css'
  return new Request(url, {
    method: 'POST',
    headers: opts.header ? { 'x-revalidate-secret': opts.header } : {},
  })
}

beforeEach(() => revalidateTag.mockReset())
afterEach(() => vi.unstubAllEnvs())

describe('POST /api/revalidate-custom-css', () => {
  it('is inert (501) when no secret is configured', async () => {
    const { POST } = await loadRoute('')
    const res = POST(post({ header: 'anything' }))
    expect(res.status).toBe(501)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a missing secret (401)', async () => {
    const { POST } = await loadRoute('s3cret')
    const res = POST(post())
    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret (401)', async () => {
    const { POST } = await loadRoute('s3cret')
    const res = POST(post({ header: 'nope' }))
    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('revalidates the tag on a correct secret via header', async () => {
    const { POST } = await loadRoute('s3cret')
    const res = POST(post({ header: 's3cret' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ revalidated: true, tag: 'amplience-custom-css' })
    expect(revalidateTag).toHaveBeenCalledWith('amplience-custom-css', 'max')
  })

  it('accepts the secret via query param too', async () => {
    const { POST } = await loadRoute('s3cret')
    const res = POST(post({ query: 's3cret' }))
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('amplience-custom-css', 'max')
  })
})
