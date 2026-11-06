/**
 * An in-memory commercetools HTTP API, for tests.
 *
 * Serves the four endpoints the adapter calls — token, categories, product
 * types, product projections — from fixture data shaped like the AnyaFinn
 * project (product type `main`, GBP/GB prices, Dynamic Media image URLs,
 * language-only locale keys). It emulates the server-side behaviour the
 * adapter relies on: the `where` predicates it sends, offset paging, price
 * selection by `priceCurrency` + `priceCountry`, and Product Search (category
 * subtree queries, order hints, the categories facet, an inactive project).
 *
 * Not a general commercetools mock: an unrecognised predicate fails the test
 * loudly rather than returning everything.
 */

import type { FetchLike } from './client'
import type { CtCategory, CtPrice, CtProductProjection, CtProductType, CtVariant } from './wire'

export const PROJECT_KEY = 'anyafinn'
export const API_URL = 'https://api.test.commercetools.com'
export const AUTH_URL = 'https://auth.test.commercetools.com'

const DI = 'https://cdn.media.amplience.net/i/anyafinn'

export const CATEGORIES: readonly CtCategory[] = [
  { id: 'cat-women', key: 'women', slug: { en: 'women' }, name: { en: 'Women' }, ancestors: [] },
  {
    id: 'cat-women-skirts',
    key: 'women-skirts',
    slug: { en: 'women-skirts' },
    ancestors: [{ typeId: 'category', id: 'cat-women' }],
  },
  {
    id: 'cat-women-tops',
    key: 'women-tops',
    slug: { en: 'women-tops' },
    ancestors: [{ typeId: 'category', id: 'cat-women' }],
  },
  { id: 'cat-home', slug: { en: 'home' }, ancestors: [] },
  {
    id: 'cat-home-lighting',
    slug: { en: 'home-lighting' },
    ancestors: [{ typeId: 'category', id: 'cat-home' }],
  },
]

export const PRODUCT_TYPES: readonly CtProductType[] = [
  {
    id: 'pt-main',
    key: 'main',
    attributes: [
      { name: 'designer', label: { en: 'Designer' } },
      { name: 'color', label: { en: 'Colour', de: 'Farbe' } },
      { name: 'details', label: { en: 'Details' } },
    ],
  },
]

const gbp = (centAmount: number, extra: Partial<CtPrice> = {}): CtPrice => ({
  value: { centAmount, currencyCode: 'GBP', fractionDigits: 2 },
  country: 'GB',
  ...extra,
})
const eur = (centAmount: number): CtPrice => ({
  value: { centAmount, currencyCode: 'EUR', fractionDigits: 2 },
  country: 'DE',
})

export const SKIRT: CtProductProjection = {
  id: 'prod-skirt',
  productType: { typeId: 'product-type', id: 'pt-main' },
  createdAt: '2026-03-01T00:00:00.000Z',
  name: { en: 'Pleated Midi Skirt', de: 'Plissierter Midirock' },
  slug: { en: 'pleated-midi-skirt', de: 'plissierter-midirock' },
  description: { en: 'A swishy pleated midi in crimson crepe.' },
  // Only the leaf — the ancestor must come from the category's `ancestors`.
  categories: [{ typeId: 'category', id: 'cat-women-skirts' }],
  masterVariant: {
    id: 1,
    sku: 'AF-SKIRT-001',
    prices: [
      gbp(4500),
      eur(5200),
      // Channel- and customer-group-scoped prices have no meaning without a cart.
      gbp(1, { channel: { id: 'chan-outlet' } }),
      gbp(2, { customerGroup: { id: 'cg-staff' } }),
    ],
    images: [
      {
        url: `${DI}/af-skirt-001`,
        label: 'Pleated midi skirt, front',
        dimensions: { w: 1200, h: 1600 },
      },
      { url: `${DI}/af-skirt-001-back`, dimensions: { w: 1200, h: 1600 } },
    ],
    attributes: [
      { name: 'designer', value: { key: 'anyafinn', label: 'AnyaFinn' } },
      { name: 'color', value: { key: 'red', label: { en: 'Red', de: 'Rot' } } },
      { name: 'details', value: [{ en: 'Machine wash' }, { en: '100% polyester' }] },
      { name: 'size', value: 'M' },
      { name: 'reference', value: { typeId: 'product', id: 'prod-other' } },
    ],
  },
  variants: [{ id: 2, sku: 'AF-SKIRT-001-L' }],
}

export const SHIRT: CtProductProjection = {
  id: 'prod-shirt',
  productType: { typeId: 'product-type', id: 'pt-main' },
  createdAt: '2026-02-01T00:00:00.000Z',
  // Merchandised first in Women, though it is older than the skirt.
  categoryOrderHints: { 'cat-women': '0.1' },
  name: { en: 'Linen Shirt' },
  slug: { en: 'linen-shirt' },
  categories: [
    { typeId: 'category', id: 'cat-women-tops' },
    // Already denormalised by the importer — must not appear twice.
    { typeId: 'category', id: 'cat-women' },
  ],
  masterVariant: {
    sku: 'AF-SHIRT-002',
    prices: [
      gbp(6000, {
        discounted: { value: { centAmount: 4800, currencyCode: 'GBP', fractionDigits: 2 } },
      }),
    ],
    images: [{ url: `${DI}/af-shirt-002`, dimensions: { w: 1000, h: 1000 } }],
    attributes: [
      { name: 'designer', value: { key: 'anyafinn', label: 'AnyaFinn' } },
      { name: 'shortDescription', value: { en: 'Breezy linen for warm days.' } },
    ],
  },
}

export const LAMP: CtProductProjection = {
  id: 'prod-lamp',
  productType: { typeId: 'product-type', id: 'pt-main' },
  createdAt: '2026-01-01T00:00:00.000Z',
  name: { en: 'Arc Table Lamp' },
  slug: { en: 'arc-table-lamp' },
  categories: [{ typeId: 'category', id: 'cat-home-lighting' }],
  masterVariant: {
    sku: 'AF-LAMP-003',
    // An unscoped price: selected for any country.
    prices: [{ value: { centAmount: 12900, currencyCode: 'GBP' } }],
    images: [{ url: 'https://images.example.com/lamp.jpg', dimensions: { w: 800, h: 800 } }],
  },
}

/** No `en` slug — the adapter must skip it, and say why. */
export const GERMAN_ONLY: CtProductProjection = {
  id: 'prod-de',
  productType: { typeId: 'product-type', id: 'pt-main' },
  name: { de: 'Nur Deutsch' },
  slug: { de: 'nur-deutsch' },
  masterVariant: { sku: 'AF-DE-004' },
}

export const PRODUCTS: readonly CtProductProjection[] = [SKIRT, SHIRT, LAMP]

export type FakeOptions = {
  readonly products?: readonly CtProductProjection[]
  /** Reject the token request, as the auth API does for bad credentials. */
  readonly refuseToken?: boolean
  /** Answer this many API calls with 401 before behaving. */
  readonly expireTokens?: number
  /** Product Search not activated: `/products/search` answers 404. */
  readonly searchInactive?: boolean
}

export type FakeCommercetools = {
  readonly fetch: FetchLike
  readonly calls: string[]
  readonly tokenRequests: () => number
}

type Query = Record<string, string[]>

const parseQuery = (url: string): { path: string; query: Query } => {
  const [path = '', search = ''] = url.split('?')
  const query: Query = {}
  for (const pair of search.split('&').filter(Boolean)) {
    const [k = '', v = ''] = pair.split('=')
    ;(query[decodeURIComponent(k)] ??= []).push(decodeURIComponent(v))
  }
  return { path, query }
}

const unquoteList = (list: string): string[] =>
  [...list.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? '').replace(/\\(.)/g, '$1'))

const filterByWhere = (
  products: readonly CtProductProjection[],
  where: string | undefined,
): readonly CtProductProjection[] => {
  if (where === undefined) return products

  const slug = /^slug\(([\w-]+) = ("(?:[^"\\]|\\.)*")\)$/.exec(where)
  if (slug) {
    const [, locale = '', literal = ''] = slug
    const value = unquoteList(literal)[0]
    return products.filter((p) => p.slug[locale] === value)
  }

  const ids = /^id in \((.*)\)$/.exec(where)
  if (ids) {
    const wanted = new Set(unquoteList(ids[1] ?? ''))
    return products.filter((p) => wanted.has(p.id))
  }

  const skus = /^masterVariant\(sku in \((.*)\)\) or variants\(sku in \((.*)\)\)$/.exec(where)
  if (skus) {
    const wanted = new Set(unquoteList(skus[1] ?? ''))
    return products.filter((p) =>
      [p.masterVariant, ...(p.variants ?? [])].some(
        (v) => v.sku !== undefined && wanted.has(v.sku),
      ),
    )
  }

  throw new Error(`fake commercetools: unsupported where predicate: ${where}`)
}

/** `createdAt desc, id asc` — the order both the adapter's reads ask for. */
const newestFirst = (a: CtProductProjection, b: CtProductProjection): number =>
  (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.id.localeCompare(b.id)

/** A product's categories plus their ancestors — what `categoriesSubTree` matches. */
const subtreeOf = (product: CtProductProjection): Set<string> => {
  const ids = new Set<string>()
  for (const ref of product.categories ?? []) {
    ids.add(ref.id)
    for (const a of CATEGORIES.find((c) => c.id === ref.id)?.ancestors ?? []) ids.add(a.id)
  }
  return ids
}

type SearchBody = {
  query?: { exact?: { field: string; value: string } }
  sort?: { field: string; order: 'asc' | 'desc' }[]
  limit?: number
  offset?: number
  facets?: { distinct?: { name: string; field: string; limit?: number } }[]
}

/** Product Search over the fixture products — ids only, as the real one returns. */
const search = (products: readonly CtProductProjection[], body: SearchBody) => {
  const exact = body.query?.exact
  if (exact && exact.field !== 'categoriesSubTree') {
    throw new Error(`fake commercetools: unsupported search query field ${exact.field}`)
  }
  const matching = exact ? products.filter((p) => subtreeOf(p).has(exact.value)) : [...products]

  const hint = body.sort?.find((s) => s.field.startsWith('categoryOrderHints.'))
  const hintFor = (p: CtProductProjection) =>
    hint ? p.categoryOrderHints?.[hint.field.slice('categoryOrderHints.'.length)] : undefined
  matching.sort((a, b) => {
    const ha = hintFor(a)
    const hb = hintFor(b)
    // Hinted first, ascending; unhinted after — as the docs describe.
    if (ha !== undefined && hb !== undefined && ha !== hb) return ha.localeCompare(hb)
    if (ha !== undefined && hb === undefined) return -1
    if (ha === undefined && hb !== undefined) return 1
    return newestFirst(a, b)
  })

  const limit = body.limit ?? 20
  const offset = body.offset ?? 0
  const facets = (body.facets ?? []).flatMap(({ distinct }) => {
    if (!distinct) return []
    if (distinct.field !== 'categories') {
      throw new Error(`fake commercetools: unsupported facet field ${distinct.field}`)
    }
    const counts = new Map<string, number>()
    for (const p of matching)
      for (const ref of p.categories ?? []) counts.set(ref.id, (counts.get(ref.id) ?? 0) + 1)
    const buckets = [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .slice(0, distinct.limit ?? 10)
    return [{ name: distinct.name, buckets }]
  })

  return {
    total: matching.length,
    offset,
    limit,
    results: matching.slice(offset, offset + limit).map((p) => ({ id: p.id })),
    ...(facets.length > 0 ? { facets } : {}),
  }
}

/** Server-side price selection, as the projection endpoints do it. */
const selectFor = (variant: CtVariant, currency?: string, country?: string): CtVariant => {
  if (!currency) return variant
  const price = (variant.prices ?? []).find(
    (p) =>
      p.value.currencyCode === currency &&
      !p.channel &&
      !p.customerGroup &&
      (p.country === undefined || p.country === country),
  )
  return price ? { ...variant, price } : variant
}

export const fakeCommercetools = (options: FakeOptions = {}): FakeCommercetools => {
  const products = options.products ?? PRODUCTS
  const calls: string[] = []
  let tokens = 0
  let expire = options.expireTokens ?? 0

  const json = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })

  const handle = (url: string, init?: { readonly method?: string; readonly body?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)

    if (url === `${AUTH_URL}/oauth/token`) {
      tokens += 1
      if (options.refuseToken) return json(400, { error: 'invalid_client' })
      return json(200, {
        access_token: `token-${tokens}`,
        expires_in: 172800,
        token_type: 'Bearer',
      })
    }

    if (expire > 0) {
      expire -= 1
      return json(401, { message: 'invalid_token' })
    }

    const { path, query } = parseQuery(url)
    const base = `${API_URL}/${PROJECT_KEY}`
    const limit = Number(query.limit?.[0] ?? 20)
    const offset = Number(query.offset?.[0] ?? 0)
    const page = <T>(all: readonly T[]) => {
      const results = all.slice(offset, offset + limit)
      const total = query.withTotal?.[0] === 'false' ? {} : { total: all.length }
      return json(200, { limit, offset, count: results.length, ...total, results })
    }

    if (path === `${base}/products/search` && init?.method === 'POST') {
      if (options.searchInactive) {
        return json(404, { statusCode: 404, message: 'ObjectNotFound', errors: [] })
      }
      return json(200, search(products, JSON.parse(init.body ?? '{}') as SearchBody))
    }
    if (path === `${base}/categories`) return page(CATEGORIES)
    if (path === `${base}/product-types`) return page(PRODUCT_TYPES)
    if (path === `${base}/product-projections`) {
      const currency = query.priceCurrency?.[0]
      const country = query.priceCountry?.[0]
      const sorted = [...products].sort(newestFirst)
      const matching = filterByWhere(sorted, query.where?.[0]).map((p) => ({
        ...p,
        masterVariant: selectFor(p.masterVariant, currency, country),
      }))
      return page(matching)
    }
    return json(404, { message: `fake commercetools: no route for ${path}` })
  }

  const fetch: FetchLike = (url, init) => Promise.resolve(handle(url, init))

  return { fetch, calls, tokenRequests: () => tokens }
}
