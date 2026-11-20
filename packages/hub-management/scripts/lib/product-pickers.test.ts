import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Plain ESM shared with hub-import.mjs; import it directly so the test
// exercises the exact code the seed runs.
import {
  commercetoolsSettings,
  MULTI_PIM_CONTENT_TYPE_FILE,
  needsCommercetools,
  seedsContentType,
  withProductPickers,
} from './product-pickers.mjs'
import { resolveTokens } from './resolve-placeholders.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const schemaFile = (name: string) =>
  JSON.parse(readFileSync(path.join(here, '../../content-type-schemas/schemas', name), 'utf8')) as {
    $id: string
    properties: Record<string, Record<string, unknown>>
  }

const carousel = schemaFile('content_product-carousel.json')
const multi = schemaFile('content_multi-pim-product-carousel.json')
const listsOf = (schema: typeof multi) =>
  (schema.properties.products as { properties: Record<string, Record<string, unknown>> }).properties

const hub = { commercetools: { projectKey: 'anyafinn', clientId: 'id', clientSecret: 'secret' } }

describe('commercetoolsSettings', () => {
  it('derives the toolkit settings, read-only scopes included', () => {
    expect(commercetoolsSettings(hub)).toEqual({
      project: 'anyafinn',
      clientId: 'id',
      clientSecret: 'secret',
      language: 'en',
      authUrl: 'https://auth.europe-west1.gcp.commercetools.com/oauth/token',
      apiUrl: 'https://api.europe-west1.gcp.commercetools.com',
      scope: 'view_published_products:anyafinn view_categories:anyafinn',
    })
  })

  it('honours a region', () => {
    const settings = commercetoolsSettings({
      commercetools: { ...hub.commercetools, region: 'us-central1.gcp' },
    })
    expect(settings?.apiUrl).toBe('https://api.us-central1.gcp.commercetools.com')
  })

  it('treats a missing or incomplete block as no commercetools', () => {
    expect(commercetoolsSettings(undefined)).toBeUndefined()
    expect(commercetoolsSettings({})).toBeUndefined()
    expect(
      commercetoolsSettings({ commercetools: { projectKey: 'p', clientId: 'id' } }),
    ).toBeUndefined()
  })
})

describe('withProductPickers', () => {
  it("gives the carousel's products field the toolkit picker on a commercetools hub", () => {
    const picked = withProductPickers(carousel, { commercetools: true })
    expect(picked.properties.products?.['ui:extension']).toMatchObject({
      name: 'ecomm-toolkit',
      params: { type: 'strings' },
    })
    // The field is still a list of strings, so content stays valid either way.
    expect(picked.properties.products?.type).toBe('array')
  })

  it('leaves the carousel a plain SKU list without commercetools', () => {
    expect(withProductPickers(carousel, { commercetools: false })).toBe(carousel)
  })

  it("keeps the multi-PIM carousel's commercetools list only on a commercetools hub", () => {
    expect(Object.keys(listsOf(withProductPickers(multi, { commercetools: false })))).toEqual([
      'cms',
    ])
    const lists = listsOf(withProductPickers(multi, { commercetools: true }))
    expect(Object.keys(lists)).toEqual(['cms', 'commercetools'])
    expect(lists.commercetools?.['ui:extension']).toMatchObject({ name: 'ecomm-toolkit' })
    expect(lists.cms?.['ui:extension']).toBeUndefined()
  })

  it('does not touch the checked-in schema', () => {
    withProductPickers(multi, { commercetools: false })
    expect(Object.keys(listsOf(multi))).toEqual(['cms', 'commercetools'])
  })

  it('returns every other schema unchanged', () => {
    const other = { $id: 'https://quadratic.amplience.com/v2/content/hero', properties: {} }
    expect(withProductPickers(other, { commercetools: true })).toBe(other)
  })
})

describe('seedsContentType', () => {
  it('registers the multi-PIM carousel only on hubs that opt in', () => {
    expect(seedsContentType(MULTI_PIM_CONTENT_TYPE_FILE, {})).toBe(false)
    expect(seedsContentType(MULTI_PIM_CONTENT_TYPE_FILE, { multiPimDemo: true })).toBe(true)
    expect(seedsContentType('content_product-carousel.json', undefined)).toBe(true)
  })
})

describe('the eComm Toolkit extension definition', () => {
  const definition = readFileSync(path.join(here, '../../extensions/ecomm-toolkit.json'), 'utf8')

  it('is recognised as needing commercetools settings', () => {
    expect(needsCommercetools(definition)).toBe(true)
  })

  it('resolves to the codec parameters the toolkit expects', () => {
    const settings = commercetoolsSettings(hub)
    const resolved = JSON.parse(
      resolveTokens(definition, {
        ...(settings && { commercetools: settings }),
        source: 'ecomm-toolkit.json',
      }),
    ) as { parameters: string }
    expect(JSON.parse(resolved.parameters)).toEqual({
      vendor: 'commercetools',
      codec_params: {
        project: 'anyafinn',
        language: 'en',
        client_id: 'id',
        client_secret: 'secret',
        auth_url: 'https://auth.europe-west1.gcp.commercetools.com/oauth/token',
        api_url: 'https://api.europe-west1.gcp.commercetools.com',
        scope: 'view_published_products:anyafinn view_categories:anyafinn',
      },
    })
  })

  it('refuses to resolve without commercetools settings', () => {
    expect(() => resolveTokens(definition, { source: 'ecomm-toolkit.json' })).toThrow(
      /commercetools/,
    )
  })
})
