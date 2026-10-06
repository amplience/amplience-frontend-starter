// The products endpoint (ADR-0027) — it serves the live-editing path.
//
// The resolve itself is `resolveProductsBySku`, covered by the port's
// conformance suite and the CMS adapter's own tests, and it is stubbed here:
// what this route owns is parsing a query string a content form can mangle,
// capping the list, and turning a locale code into a `Locale`. Reaching into
// fixture data instead would make the test depend on which set is active — and
// only `anyafinn` carries products at all.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Locale } from '../../../lib/locales'
import { defaultLocale, locales } from '../../../lib/locales'

const resolveProductsBySku = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/resolve-products', () => ({ resolveProductsBySku }))

const { GET } = await import('./route')

const product = (sku: string) => ({ sku, slug: 'x', name: sku, href: `/products/x` })

const call = async (query: string) => {
  const res = await GET(new Request(`https://example.invalid/api/products${query}`))
  return { res, body: (await res.json()) as { products?: { sku: string }[]; error?: string } }
}

/** The SKUs and locale the route forwarded on its last call. */
const forwarded = () =>
  resolveProductsBySku.mock.calls.at(-1) as [readonly string[], Locale] | undefined

beforeEach(() => {
  resolveProductsBySku.mockReset()
  resolveProductsBySku.mockImplementation((skus: readonly string[]) =>
    Promise.resolve(new Map(skus.map((s) => [s, product(s)]))),
  )
})

describe('GET /api/products', () => {
  it('resolves the SKUs it is given', async () => {
    const { res, body } = await call('?skus=A,B')
    expect(res.status).toBe(200)
    expect(body.products?.map((p) => p.sku)).toEqual(['A', 'B'])
  })

  it('trims whitespace around SKUs, which a pasted list carries', async () => {
    await call('?skus=%20A%20,%20B%20')
    expect(forwarded()?.[0]).toEqual(['A', 'B'])
  })

  it('passes through only what resolved, so a bad SKU shortens the rail', async () => {
    resolveProductsBySku.mockResolvedValueOnce(new Map([['A', product('A')]]))
    const { body } = await call('?skus=A,GONE')
    expect(body.products?.map((p) => p.sku)).toEqual(['A'])
  })

  it.each(['', '?skus=', '?skus=,,', '?skus=%20'])(
    'treats %s as no SKUs, without calling the source',
    async (query) => {
      const { res, body } = await call(query)
      expect(res.status).toBe(200)
      expect(body.products).toEqual([])
      expect(resolveProductsBySku).not.toHaveBeenCalled()
    },
  )

  it('refuses an oversized list rather than reading the catalogue for it', async () => {
    const { res, body } = await call(
      `?skus=${Array.from({ length: 101 }, (_, i) => `S${i}`).join(',')}`,
    )
    expect(res.status).toBe(400)
    expect(body.error).toContain('100')
    expect(resolveProductsBySku).not.toHaveBeenCalled()
  })

  it('allows a list right at the cap', async () => {
    const { res } = await call(`?skus=${Array.from({ length: 100 }, (_, i) => `S${i}`).join(',')}`)
    expect(res.status).toBe(200)
  })

  it('is never cached — an author must see the edit they just made', async () => {
    const { res } = await call('?skus=A')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('forwards the requested locale, so live prices match the server render', async () => {
    const other = locales.find((l) => l.code !== defaultLocale.code)
    if (other === undefined) return
    await call(`?skus=A&locale=${other.code}`)
    expect(forwarded()?.[1].code).toBe(other.code)
  })

  it.each(['', '&locale=xx-XX'])('falls back to the default locale for "%s"', async (suffix) => {
    await call(`?skus=A${suffix}`)
    expect(forwarded()?.[1].code).toBe(defaultLocale.code)
  })
})
