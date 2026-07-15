/**
 * Optional CMS custom-CSS helper (getCustomCss).
 *
 * The contract: off unless AMPLIENCE_CUSTOM_CSS is exactly "TRUE"/"1"
 * (case-insensitive) — and when off it does no CMS I/O at all, so default
 * deployments stay pure-static. When on it returns the item's CSS, neutralises
 * a </style> breakout, treats blank/missing/errored as "nothing" (null), and
 * reads from the site-namespaced delivery key.
 *
 * The flag is read at module load, so each case re-imports the module under a
 * stubbed env. The content client and the ISR cache wrapper are mocked: the
 * wrapper is a pass-through so the fetch runs inline.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getByKey = vi.fn()

vi.mock('./content-client', () => ({
  client: { getByKey },
  siteName: 'acme',
}))

vi.mock('next/cache', () => ({
  // Pass-through: return the wrapped fn so calling it runs the real body.
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

// '' models an unset flag — the gate treats empty and absent identically.
async function loadWithFlag(flag: string) {
  vi.resetModules()
  vi.stubEnv('AMPLIENCE_CUSTOM_CSS', flag)
  return import('./custom-css')
}

beforeEach(() => {
  getByKey.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getCustomCss — feature gate', () => {
  it('returns null and does no CMS I/O when the flag is unset', async () => {
    const { getCustomCss } = await loadWithFlag('')
    expect(await getCustomCss()).toBeNull()
    expect(getByKey).not.toHaveBeenCalled()
  })

  it('returns null and does no CMS I/O when the flag is "FALSE"', async () => {
    const { getCustomCss } = await loadWithFlag('FALSE')
    expect(await getCustomCss()).toBeNull()
    expect(getByKey).not.toHaveBeenCalled()
  })
})

describe('getCustomCss — enabled', () => {
  it('returns the trimmed CSS from the site-namespaced delivery key', async () => {
    getByKey.mockResolvedValue({ css: '  body { color: red } ' })
    const { getCustomCss } = await loadWithFlag('TRUE')
    expect(await getCustomCss()).toBe('body { color: red }')
    expect(getByKey).toHaveBeenCalledWith('acme/site/custom-css')
  })

  it('accepts a lowercase/alternate truthy flag ("1")', async () => {
    getByKey.mockResolvedValue({ css: '.x{color:blue}' })
    const { getCustomCss } = await loadWithFlag('1')
    expect(await getCustomCss()).toBe('.x{color:blue}')
  })

  it('neutralises a </style> breakout', async () => {
    getByKey.mockResolvedValue({ css: 'a{}</style><script>alert(1)</script>' })
    const { getCustomCss } = await loadWithFlag('true')
    const css = await getCustomCss()
    expect(css).not.toContain('</style>')
    expect(css).toContain('<\\/style>')
  })

  it('returns null when the item has blank CSS', async () => {
    getByKey.mockResolvedValue({ css: '   ' })
    const { getCustomCss } = await loadWithFlag('TRUE')
    expect(await getCustomCss()).toBeNull()
  })

  it('returns null when the item has no css field', async () => {
    getByKey.mockResolvedValue({})
    const { getCustomCss } = await loadWithFlag('TRUE')
    expect(await getCustomCss()).toBeNull()
  })

  it('degrades to null when the delivery fetch throws (e.g. not-found)', async () => {
    getByKey.mockRejectedValue(new Error('not-found'))
    const { getCustomCss } = await loadWithFlag('TRUE')
    expect(await getCustomCss()).toBeNull()
  })
})
