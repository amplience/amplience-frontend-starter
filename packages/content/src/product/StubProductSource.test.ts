import { describe, expect, it, vi } from 'vitest'

import { describeProductSource } from './conformance'
import { StubProductSource } from './StubProductSource'
import { missingSkus, warnOnMissingSkus } from './warnings'

/** `console` via globalThis — this package compiles without DOM/node types. */
const globalConsole = (globalThis as unknown as { console: { warn: (m: string) => void } }).console

describeProductSource('StubProductSource', () => ({
  source: new StubProductSource(),
  knownSlug: 'aurora-lounge-chair',
  knownSku: 'AUR-CHAIR-01',
  emptySource: new StubProductSource({ products: [] }),
}))

describe('StubProductSource specifics', () => {
  it('filters by category', async () => {
    const source = new StubProductSource()
    const { products, total } = await source.list({ category: 'Tables' })
    expect(products.map((p) => p.sku)).toEqual(['AUR-TABLE-01'])
    expect(total).toBe(1)
  })

  it('serves a product with no price, images or attributes', async () => {
    const product = await new StubProductSource().getBySlug('aurora-shelving')
    expect(product.price).toBeUndefined()
    expect(product.images).toBeUndefined()
    expect(product.attributes).toBeUndefined()
    expect(product.status).toBe('coming-soon')
  })

  it('accepts an injected catalogue', async () => {
    const source = new StubProductSource({
      products: [{ sku: 'X', slug: 'x', name: 'X' }],
    })
    expect(await source.listSlugs()).toEqual(['x'])
  })
})

describe('missingSkus', () => {
  it('returns requested SKUs absent from the resolved set, in request order', () => {
    expect(missingSkus(['a', 'b', 'c'], [{ sku: 'b' }])).toEqual(['a', 'c'])
  })

  it('returns nothing when everything resolved', () => {
    expect(missingSkus(['a'], [{ sku: 'a' }])).toEqual([])
  })
})

describe('warnOnMissingSkus', () => {
  it('warns once, naming the missing SKUs', () => {
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    warnOnMissingSkus(['A', 'B'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('A, B')
    warn.mockRestore()
  })

  it('says nothing when nothing is missing', () => {
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    warnOnMissingSkus([])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('stays silent in production', () => {
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'production')
    try {
      warnOnMissingSkus(['A'])
      expect(warn).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
      warn.mockRestore()
    }
  })
})
