import { describe, expect, it, vi } from 'vitest'

import { isContentClientError } from '../../types'
import { describeProductSource } from '../conformance'
import { CommercetoolsClient } from './client'
import { CommercetoolsProductSource } from './CommercetoolsProductSource'
import type { CommercetoolsProductSourceOptions } from './CommercetoolsProductSource'
import { makeCommercetoolsProductSource, resolveCommercetoolsConfig } from './config'
import type { FakeOptions } from './fakeCommercetools'
import {
  API_URL,
  AUTH_URL,
  fakeCommercetools,
  GERMAN_ONLY,
  PRODUCTS,
  PROJECT_KEY,
  SHIRT,
  SKIRT,
} from './fakeCommercetools'
import type { CtProductProjection } from './wire'

/** `console` via globalThis — this package compiles without DOM/node types. */
const globalConsole = (globalThis as unknown as { console: { warn: (m: string) => void } }).console

const setup = (
  fake: FakeOptions = {},
  options: Omit<CommercetoolsProductSourceOptions, 'client'> = {},
) => {
  const server = fakeCommercetools(fake)
  const client = new CommercetoolsClient({
    projectKey: PROJECT_KEY,
    clientId: 'id',
    clientSecret: 'secret',
    apiUrl: API_URL,
    authUrl: AUTH_URL,
    fetch: server.fetch,
  })
  return { server, source: new CommercetoolsProductSource({ client, ...options }) }
}

const quiet = () => vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)

describeProductSource('CommercetoolsProductSource', () => ({
  source: setup().source,
  knownSlug: 'pleated-midi-skirt',
  knownSku: 'AF-SKIRT-001',
  emptySource: setup({ products: [] }).source,
}))

describe('CommercetoolsProductSource specifics', () => {
  describe('mapping', () => {
    it('maps the core fields, with the master variant as the SKU', async () => {
      const product = await setup().source.getBySlug('pleated-midi-skirt', { locale: 'en-GB,*' })
      expect(product).toMatchObject({
        sku: 'AF-SKIRT-001',
        slug: 'pleated-midi-skirt',
        name: 'Pleated Midi Skirt',
        description: 'A swishy pleated midi in crimson crepe.',
        status: 'active',
      })
    })

    it('never uses the long description as the short one', async () => {
      // commercetools' `description` is long-form; a card showing it is wrong.
      const product = await setup().source.getBySlug('pleated-midi-skirt')
      expect(product.shortDescription).toBeUndefined()
    })

    it('reads a short description from its attribute, and keeps it out of the spec rows', async () => {
      const product = await setup().source.getBySlug('linen-shirt')
      expect(product.shortDescription).toBe('Breezy linen for warm days.')
      expect(product.attributes?.map((a) => a.label)).not.toContain('Short description')
    })

    it('falls back from a regional locale to its language', async () => {
      // AnyaFinn, like the commercetools sample data, keys values by language.
      const product = await setup().source.getBySlug('pleated-midi-skirt', {
        locale: 'de-DE,en-GB,*',
      })
      expect(product.name).toBe('Plissierter Midirock')
      // The slug stays in the one slug locale — URLs are not localized.
      expect(product.slug).toBe('pleated-midi-skirt')
    })

    it('converts minor units to major units', async () => {
      const product = await setup().source.getBySlug('pleated-midi-skirt', {
        locale: 'en-GB,*',
        currency: 'GBP',
      })
      expect(product.price).toEqual({ amount: 45, currencyCode: 'GBP' })
    })

    it('selects a country-scoped price using the locale region', async () => {
      const { source, server } = setup()
      const product = await source.getBySlug('pleated-midi-skirt', {
        locale: 'de-DE,*',
        currency: 'EUR',
      })
      expect(product.price).toEqual({ amount: 52, currencyCode: 'EUR' })
      expect(server.calls.some((c) => c.includes('priceCountry=DE'))).toBe(true)
    })

    it('still finds a price when server selection misses the country', async () => {
      // en-US → country US, but the GBP price is scoped to GB: commercetools
      // selects nothing, and the adapter selects from prices[] instead.
      const product = await setup().source.getBySlug('pleated-midi-skirt', {
        locale: 'en-US,*',
        currency: 'GBP',
      })
      expect(product.price).toEqual({ amount: 45, currencyCode: 'GBP' })
    })

    it('never substitutes another currency', async () => {
      const warn = quiet()
      try {
        const product = await setup().source.getBySlug('linen-shirt', { currency: 'USD' })
        expect(product.price).toBeUndefined()
      } finally {
        warn.mockRestore()
      }
    })

    it('shows the discounted amount when a discount applies', async () => {
      const product = await setup().source.getBySlug('linen-shirt', {
        locale: 'en-GB,*',
        currency: 'GBP',
      })
      expect(product.price).toEqual({ amount: 48, currencyCode: 'GBP' })
    })

    it('keeps one price per currency and ignores channel and customer-group prices', async () => {
      const product = await setup().source.getBySlug('pleated-midi-skirt')
      expect(product.prices).toEqual([
        { amount: 45, currencyCode: 'GBP' },
        { amount: 52, currencyCode: 'EUR' },
      ])
    })

    it('honours a fixed price country over the locale', async () => {
      const { source, server } = setup({}, { priceCountry: 'gb' })
      await source.getBySlug('pleated-midi-skirt', { locale: 'de-DE,*', currency: 'GBP' })
      expect(server.calls.some((c) => c.includes('priceCountry=GB'))).toBe(true)
    })

    it('maps images with their label and dimensions', async () => {
      const product = await setup().source.getBySlug('pleated-midi-skirt')
      expect(product.images?.[0]).toEqual({
        url: 'https://cdn.media.amplience.net/i/anyafinn/af-skirt-001',
        alt: 'Pleated midi skirt, front',
        width: 1200,
        height: 1600,
      })
      expect(product.images).toHaveLength(2)
    })

    it('trims image URLs and drops ones that are not absolute', async () => {
      const product = {
        ...SHIRT,
        masterVariant: {
          ...SHIRT.masterVariant,
          images: [
            {
              url: ' https://cdn.media.amplience.net/i/anyafinn/af-shirt-002 ',
              dimensions: { w: 10, h: 10 },
            },
            { url: 'not a url' },
          ],
        },
      }
      const { source } = setup({ products: [product] })
      const resolved = await source.getBySlug('linen-shirt')
      expect(resolved.images?.map((i) => i.url)).toEqual([
        'https://cdn.media.amplience.net/i/anyafinn/af-shirt-002',
      ])
    })

    it('reads the brand from the designer enum and keeps it out of the spec rows', async () => {
      const product = await setup().source.getBySlug('pleated-midi-skirt', { locale: 'en-GB,*' })
      expect(product.brand).toBe('AnyaFinn')
      expect(product.attributes?.map((a) => a.label)).not.toContain('Designer')
    })

    it('labels attributes from the product type and renders their values', async () => {
      const product = await setup().source.getBySlug('pleated-midi-skirt', { locale: 'de-DE,*' })
      expect(product.attributes).toEqual([
        { label: 'Farbe', value: 'Rot' },
        { label: 'Details', value: 'Machine wash, 100% polyester' },
        // No product-type label: humanised from the name.
        { label: 'Size', value: 'M' },
        // The reference attribute is skipped — it has no text form.
      ])
    })

    it('denormalises ancestors from the category tree', async () => {
      const product = await setup().source.getBySlug('pleated-midi-skirt')
      expect(product.categories).toEqual(['women', 'women-skirts'])
    })

    it('does not repeat an ancestor the product is also assigned to', async () => {
      const product = await setup().source.getBySlug('linen-shirt')
      expect(product.categories).toEqual(['women', 'women-tops'])
    })

    it('addresses a category by slug, then key, then id', async () => {
      const categories = await setup().source.listCategories()
      expect(categories).toEqual(['home', 'home-lighting', 'women', 'women-skirts', 'women-tops'])
    })

    it('honours a different slug locale', async () => {
      const { source } = setup({}, { slugLocale: 'de' })
      const warn = quiet()
      try {
        expect(await source.listSlugs()).toEqual(['plissierter-midirock'])
        expect((await source.getBySlug('plissierter-midirock')).sku).toBe('AF-SKIRT-001')
      } finally {
        warn.mockRestore()
      }
    })
  })

  describe('reads', () => {
    it('lists by category, ancestors included', async () => {
      const { products, total } = await setup().source.list({ category: 'women' })
      expect(products.map((p) => p.sku)).toEqual(['AF-SKIRT-001', 'AF-SHIRT-002'])
      expect(total).toBe(2)
    })

    it('resolves a variant SKU to its product', async () => {
      const products = await setup().source.getBySkus(['AF-SKIRT-001-L', 'AF-LAMP-003'])
      expect(products.map((p) => p.sku)).toEqual(['AF-SKIRT-001', 'AF-LAMP-003'])
    })

    it('skips products with no slug in the slug locale, and says which locales exist', async () => {
      const warn = quiet()
      try {
        const { source } = setup({ products: [...PRODUCTS, GERMAN_ONLY] })
        expect(await source.listSlugs()).not.toContain('nur-deutsch')
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(/1 of 4 .*Slug locales in this project: de, en/),
        )
      } finally {
        warn.mockRestore()
      }
    })

    it('summarises missing currencies in one line, not one per product', async () => {
      const warn = quiet()
      try {
        await setup().source.list({ currency: 'USD' })
        const lines = warn.mock.calls.map(([m]) => m).filter((m) => m.includes('no USD price'))
        expect(lines).toHaveLength(1)
        expect(lines[0]).toMatch(/3 of 3 .*GBP ×3, EUR ×1/)
      } finally {
        warn.mockRestore()
      }
    })

    it('reads the project once for every locale and currency', async () => {
      const { source, server } = setup()
      await source.list({ locale: 'en-GB,*', currency: 'GBP' })
      await source.list({ locale: 'de-DE,*', currency: 'EUR' })
      await source.listCategories()
      expect(server.calls.filter((c) => c.includes('/product-projections'))).toHaveLength(1)
    })

    it('selects prices locally on listings, by currency and locale country', async () => {
      const { products } = await setup().source.list({ locale: 'de-DE,*', currency: 'EUR' })
      expect(products.find((p) => p.sku === 'AF-SKIRT-001')?.price).toEqual({
        amount: 52,
        currencyCode: 'EUR',
      })
    })

    it('pages past the 500-result limit', async () => {
      const many: CtProductProjection[] = Array.from({ length: 501 }, (_, i) => ({
        ...SKIRT,
        id: `prod-${i}`,
        slug: { en: `product-${i}` },
        masterVariant: { sku: `SKU-${i}` },
        variants: [],
      }))
      const { source, server } = setup({ products: many })
      expect(await source.listSlugs()).toHaveLength(501)
      expect(server.calls.filter((c) => c.includes('/product-projections?'))).toHaveLength(2)
    })

    it('reuses the catalogue within the TTL', async () => {
      let clock = 0
      const { source, server } = setup({}, { cacheTtlMs: 1000, now: () => clock })
      const projectionReads = () =>
        server.calls.filter((c) => c.includes('/product-projections')).length

      await source.list()
      await source.listSlugs()
      expect(projectionReads()).toBe(1)

      clock = 1001
      await source.list()
      expect(projectionReads()).toBe(2)
    })

    it('reads product pages live, whatever the TTL', async () => {
      const { source, server } = setup()
      await source.getBySlug('linen-shirt')
      await source.getBySlug('linen-shirt')
      expect(server.calls.filter((c) => c.includes('where='))).toHaveLength(2)
    })
  })

  describe('auth', () => {
    it('reuses one token across requests', async () => {
      const { source, server } = setup()
      await Promise.all([
        source.list(),
        source.getBySlug('linen-shirt'),
        source.getBySkus(['AF-LAMP-003']),
      ])
      expect(server.tokenRequests()).toBe(1)
    })

    it('retries once with a fresh token after a 401', async () => {
      const { source, server } = setup({ expireTokens: 1 })
      await expect(source.getBySlug('linen-shirt')).resolves.toBeDefined()
      expect(server.tokenRequests()).toBe(2)
    })

    it('maps refused credentials to an unauthorised error', async () => {
      const error = await setup({ refuseToken: true })
        .source.list()
        .then(
          () => undefined,
          (e: unknown) => e,
        )
      expect(isContentClientError(error)).toBe(true)
      expect((error as { kind: string }).kind).toBe('unauthorised')
    })
  })
})

describe('resolveCommercetoolsConfig', () => {
  const env = { CTP_PROJECT_KEY: 'anyafinn', CTP_CLIENT_ID: 'id', CTP_CLIENT_SECRET: 'secret' }

  it('derives the API and auth URLs from the default region', () => {
    expect(resolveCommercetoolsConfig(env)).toEqual({
      projectKey: 'anyafinn',
      clientId: 'id',
      clientSecret: 'secret',
      apiUrl: 'https://api.europe-west1.gcp.commercetools.com',
      authUrl: 'https://auth.europe-west1.gcp.commercetools.com',
    })
  })

  it('names every missing credential at once', () => {
    expect(() => resolveCommercetoolsConfig({ CTP_PROJECT_KEY: 'x' })).toThrow(
      /needs CTP_CLIENT_ID, CTP_CLIENT_SECRET/,
    )
  })

  it('reads the optional settings', () => {
    const config = resolveCommercetoolsConfig({
      ...env,
      CTP_REGION: 'us-central1.gcp',
      CTP_SLUG_LOCALE: 'en-US',
      CTP_PRICE_COUNTRY: 'US',
      CTP_BRAND_ATTRIBUTES: 'brand, vendor',
      CTP_CACHE_TTL_SECONDS: '0',
      CTP_SCOPES: 'view_products:anyafinn',
    })
    expect(config).toMatchObject({
      apiUrl: 'https://api.us-central1.gcp.commercetools.com',
      slugLocale: 'en-US',
      priceCountry: 'US',
      brandAttributes: ['brand', 'vendor'],
      cacheTtlMs: 0,
      scopes: 'view_products:anyafinn',
    })
  })

  it('rejects a nonsense TTL', () => {
    expect(() => resolveCommercetoolsConfig({ ...env, CTP_CACHE_TTL_SECONDS: 'soon' })).toThrow(
      /CTP_CACHE_TTL_SECONDS/,
    )
  })

  it('builds a working source from a config', async () => {
    const server = fakeCommercetools()
    const source = makeCommercetoolsProductSource(
      { ...resolveCommercetoolsConfig(env), apiUrl: API_URL, authUrl: AUTH_URL },
      server.fetch,
    )
    expect(await source.listSlugs()).toHaveLength(3)
  })
})
