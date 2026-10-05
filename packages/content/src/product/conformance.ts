/**
 * The shared `ProductSource` contract suite (ADR-0018).
 *
 * Every adapter runs this — the stub today, `CmsProductSource` next, a
 * commercetools adapter later. It asserts only what is true of *any* source
 * regardless of where the data lives, so a source that passes is one the
 * routes can be pointed at without reading its implementation.
 *
 * This is what makes "swap the adapter" checkable rather than aspirational:
 * it is the swap rehearsal, run on every commit instead of once by hand.
 *
 * Adapter-specific behaviour — delivery keys, site scoping, PIM pagination —
 * belongs in that adapter's own test file, not here.
 */

import { describe, expect, it, vi } from 'vitest'

import type { ProductSource } from '../product-port'
import type { Product } from '../product-types'
import { isContentClientError } from '../types'

export type ConformanceFixture = {
  /** A source holding at least two products. */
  readonly source: ProductSource
  /** A slug that resolves in `source`. */
  readonly knownSlug: string
  /** A SKU that resolves in `source`. */
  readonly knownSku: string
  /** Optional: a source holding no products, to cover empty-catalogue paths. */
  readonly emptySource?: ProductSource
}

/** `console` via globalThis — this package compiles without DOM/node types. */
const globalConsole = (globalThis as unknown as { console: { warn: (m: string) => void } }).console

const CAPABILITY_KEYS = [
  'search',
  'facets',
  'pagination',
  'variants',
  'realtimePricing',
  'inventory',
] as const

export const describeProductSource = (
  name: string,
  createFixture: () => ConformanceFixture | Promise<ConformanceFixture>,
): void => {
  describe(`ProductSource contract: ${name}`, () => {
    const fixture = async () => await createFixture()

    describe('capabilities', () => {
      it('declares every capability explicitly', async () => {
        const { source } = await fixture()
        for (const key of CAPABILITY_KEYS) {
          expect(typeof source.capabilities[key], `capabilities.${key}`).toBe('boolean')
        }
      })
    })

    describe('getBySlug', () => {
      it('returns the product for a known slug', async () => {
        const { source, knownSlug } = await fixture()
        const product = await source.getBySlug(knownSlug)
        expect(product.slug).toBe(knownSlug)
      })

      it('returns the required core fields', async () => {
        const { source, knownSlug } = await fixture()
        const product = await source.getBySlug(knownSlug)
        expect(typeof product.sku).toBe('string')
        expect(typeof product.slug).toBe('string')
        expect(typeof product.name).toBe('string')
        expect(product.sku.length).toBeGreaterThan(0)
        expect(product.name.length).toBeGreaterThan(0)
      })

      it('throws a typed not-found for an unknown slug', async () => {
        const { source } = await fixture()
        const error = await source.getBySlug('no-such-product-xyz').then(
          () => undefined,
          (e: unknown) => e,
        )
        expect(isContentClientError(error)).toBe(true)
        expect((error as { kind: string }).kind).toBe('not-found')
      })
    })

    describe('getBySkus', () => {
      it('returns products in the order requested', async () => {
        const { source } = await fixture()
        const { products } = await source.list()
        const skus = products.slice(0, 2).map((p) => p.sku)
        if (skus.length < 2) return

        const forwards = await source.getBySkus(skus)
        const backwards = await source.getBySkus([...skus].reverse())
        expect(forwards.map((p) => p.sku)).toEqual(skus)
        expect(backwards.map((p) => p.sku)).toEqual([...skus].reverse())
      })

      it('drops unresolved SKUs rather than throwing', async () => {
        const { source, knownSku } = await fixture()
        const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
        try {
          const products = await source.getBySkus([knownSku, 'NOT-A-REAL-SKU'])
          expect(products.map((p) => p.sku)).toEqual([knownSku])
        } finally {
          warn.mockRestore()
        }
      })

      it('returns an empty array for an empty request', async () => {
        const { source } = await fixture()
        expect(await source.getBySkus([])).toEqual([])
      })
    })

    describe('list', () => {
      it('returns products with no options', async () => {
        const { source } = await fixture()
        const { products } = await source.list()
        expect(Array.isArray(products)).toBe(true)
        expect(products.length).toBeGreaterThan(0)
      })

      it('reports a total no smaller than the page it returned', async () => {
        const { source } = await fixture()
        const { products, total } = await source.list()
        if (total === undefined) return
        expect(total).toBeGreaterThanOrEqual(products.length)
      })

      it('honours limit and offset, however it implements them', async () => {
        const { source } = await fixture()
        const all = (await source.list()).products
        if (all.length < 2) return

        const first = await source.list({ limit: 1 })
        expect(first.products).toHaveLength(1)
        expect(first.products[0]?.sku).toBe(all[0]?.sku)

        const second = await source.list({ limit: 1, offset: 1 })
        expect(second.products[0]?.sku).toBe(all[1]?.sku)
      })
    })

    describe('listSlugs', () => {
      it('agrees with list', async () => {
        const { source } = await fixture()
        const slugs = await source.listSlugs()
        const listed = (await source.list()).products.map((p: Product) => p.slug)
        expect([...slugs].sort()).toEqual([...listed].sort())
      })

      it('returns unique slugs', async () => {
        const { source } = await fixture()
        const slugs = await source.listSlugs()
        expect(new Set(slugs).size).toBe(slugs.length)
      })

      it('every slug it returns resolves', async () => {
        const { source } = await fixture()
        for (const slug of await source.listSlugs()) {
          await expect(source.getBySlug(slug)).resolves.toBeDefined()
        }
      })
    })

    describe('listCategories', () => {
      it('returns a flat set of unique identifiers', async () => {
        const { source } = await fixture()
        const categories = await source.listCategories()
        expect(Array.isArray(categories)).toBe(true)
        for (const category of categories) expect(typeof category).toBe('string')
        expect(new Set(categories).size).toBe(categories.length)
      })

      it('agrees with the categories on the products, in both directions', async () => {
        // The set is a projection of product values (ADR-0024) — so a category
        // no product is in, or a product in a category the set omits, means the
        // source has grown a second opinion about the taxonomy.
        const { source } = await fixture()
        const categories = await source.listCategories()
        const { products } = await source.list()
        const onProducts = new Set(products.flatMap((p: Product) => p.categories ?? []))
        expect([...categories].sort()).toEqual([...onProducts].sort())
      })

      it('returns categories that each match at least one product', async () => {
        const { source } = await fixture()
        for (const category of await source.listCategories()) {
          const { products } = await source.list({ category })
          expect(products.length, `category "${category}"`).toBeGreaterThan(0)
        }
      })
    })

    describe('empty catalogue', () => {
      it('lists nothing without throwing', async () => {
        const { emptySource } = await fixture()
        if (!emptySource) return
        expect((await emptySource.list()).products).toEqual([])
        expect(await emptySource.listSlugs()).toEqual([])
        // An empty set, not an error: "this source has no categories" is a
        // real answer that routes to 404.
        expect(await emptySource.listCategories()).toEqual([])
      })
    })
  })
}
