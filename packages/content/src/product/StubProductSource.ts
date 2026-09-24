/**
 * A worked reference implementation of `ProductSource` (ADR-0018).
 *
 * Two jobs. It is the fixture the conformance suite runs against, and it is
 * the example an integrator reads before writing a real adapter — so it is
 * written to be read: no cleverness, every contract obligation visible, and
 * the mapping from "my source's shape" to `Product` done explicitly rather
 * than by spreading.
 *
 * Writing a real adapter means replacing `PRODUCTS` with a call to your
 * backend, mapping its response into `Product`, and setting `capabilities`
 * to what you can actually serve. Everything else here is the contract and
 * transfers unchanged.
 */

import type { ProductSource } from '../product-port'
import type {
  Product,
  ProductListOptions,
  ProductListResult,
  SourceCapabilities,
} from '../product-types'
import { NO_CAPABILITIES } from '../product-types'
import { ContentClientError } from '../types'
import { missingSkus, warnOnMissingSkus } from './warnings'

/**
 * Three products covering the shapes the frontend has to survive: fully
 * populated, minimal (no price, no images, no attributes), and
 * multi-image. A real adapter fetches these instead.
 */
const PRODUCTS: readonly Product[] = [
  {
    sku: 'AUR-CHAIR-01',
    slug: 'aurora-lounge-chair',
    name: 'Aurora Lounge Chair',
    price: { amount: 749, currencyCode: 'GBP' },
    prices: [
      { amount: 749, currencyCode: 'GBP' },
      { amount: 869, currencyCode: 'EUR' },
      { amount: 949, currencyCode: 'USD' },
    ],
    shortDescription: 'A low-slung lounge chair in oiled oak and bouclé.',
    images: [
      {
        url: 'https://example.invalid/aurora-1.jpg',
        alt: 'Aurora chair, front',
        width: 1600,
        height: 1200,
      },
      {
        url: 'https://example.invalid/aurora-2.jpg',
        alt: 'Aurora chair, side',
        width: 1600,
        height: 1200,
      },
    ],
    attributes: [
      { label: 'Frame', value: 'Oiled oak' },
      { label: 'Upholstery', value: 'Wool bouclé' },
    ],
    brand: 'Aurora',
    categories: ['home', 'home-seating'],
    tags: ['oak', 'lounge'],
    status: 'active',
  },
  {
    sku: 'AUR-TABLE-01',
    slug: 'aurora-side-table',
    name: 'Aurora Side Table',
    price: { amount: 229, currencyCode: 'GBP' },
    prices: [
      { amount: 229, currencyCode: 'GBP' },
      { amount: 265, currencyCode: 'EUR' },
      { amount: 289, currencyCode: 'USD' },
    ],
    images: [{ url: 'https://example.invalid/table-1.jpg', alt: 'Aurora side table' }],
    brand: 'Aurora',
    categories: ['home', 'home-tables'],
    status: 'active',
  },
  {
    // Deliberately bare: no price, no images, no attributes. The zero case
    // the PLP and PDP both have to render without falling over.
    sku: 'AUR-SHELF-01',
    slug: 'aurora-shelving',
    name: 'Aurora Shelving',
    brand: 'Aurora',
    categories: ['home', 'home-storage'],
    status: 'coming-soon',
  },
]

export type StubProductSourceOptions = {
  /** Override the catalogue — handy for testing empty and single-item states. */
  readonly products?: readonly Product[]
  /** Override advertised capabilities. Defaults to none, like the CMS source. */
  readonly capabilities?: SourceCapabilities
}

export class StubProductSource implements ProductSource {
  readonly capabilities: SourceCapabilities

  readonly #products: readonly Product[]

  constructor(opts: StubProductSourceOptions = {}) {
    this.#products = opts.products ?? PRODUCTS
    this.capabilities = opts.capabilities ?? NO_CAPABILITIES
  }

  // The stub is genuinely synchronous — the catalogue is a module constant.
  // The methods are typed as `Promise<T>` to satisfy the `ProductSource` port
  // (real adapters do I/O), so we wrap the result in `Promise.resolve` /
  // `Promise.reject` rather than using `async`, which would lie about the
  // implementation and trip `require-await`. A real adapter is `async` and
  // awaits its transport — that is the one line here that won't transfer.

  // The port rejects with a typed not-found rather than resolving undefined,
  // so callers discriminate with `isContentClientError` instead of null checks.
  getBySlug(slug: string): Promise<Product> {
    const product = this.#products.find((p) => p.slug === slug)
    if (!product) {
      return Promise.reject(new ContentClientError('not-found', `No product with slug "${slug}"`))
    }
    return Promise.resolve(product)
  }

  // Request order, misses dropped, misses warned outside production.
  getBySkus(skus: readonly string[]): Promise<readonly Product[]> {
    const bySku = new Map(this.#products.map((p) => [p.sku, p]))
    const resolved = skus.map((sku) => bySku.get(sku)).filter((p): p is Product => p !== undefined)
    warnOnMissingSkus(missingSkus(skus, resolved))
    return Promise.resolve(resolved)
  }

  list(opts: ProductListOptions = {}): Promise<ProductListResult> {
    // Exact membership — ancestors are denormalised onto each product.
    const { category } = opts
    const matching = category
      ? this.#products.filter((p) => p.categories?.includes(category))
      : this.#products

    // `capabilities.pagination` is false, so limit/offset are honoured by
    // slicing after the fact rather than pushed down to the source. `total`
    // is the count before slicing — that is what a pager needs.
    const offset = opts.offset ?? 0
    const products =
      opts.limit === undefined
        ? matching.slice(offset)
        : matching.slice(offset, offset + opts.limit)

    return Promise.resolve({ products, total: matching.length })
  }

  listSlugs(): Promise<readonly string[]> {
    return Promise.resolve(this.#products.map((p) => p.slug))
  }
}
