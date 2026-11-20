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
  it("gives the carousel's products field the commercetools picker on a commercetools hub", () => {
    const picked = withProductPickers(carousel, { commercetools: true })
    expect(picked.properties.products?.['ui:extension']).toMatchObject({
      name: 'ecomm-toolkit-commercetools',
      params: { type: 'strings' },
    })
    // The field is still a list of strings, so content stays valid either way.
    expect(picked.properties.products?.type).toBe('array')
  })

  it("gives the carousel's products field the Amplience PIM picker without commercetools", () => {
    const picked = withProductPickers(carousel, { commercetools: false })
    expect(picked.properties.products?.['ui:extension']).toMatchObject({
      name: 'ecomm-toolkit-amplience',
      params: { type: 'strings' },
    })
    expect(picked.properties.products?.type).toBe('array')
  })

  it("gives each multi-PIM list its own source's picker", () => {
    const lists = listsOf(withProductPickers(multi, { commercetools: true }))
    expect(Object.keys(lists)).toEqual(['cms', 'commercetools'])
    expect(lists.cms?.['ui:extension']).toMatchObject({ name: 'ecomm-toolkit-amplience' })
    expect(lists.commercetools?.['ui:extension']).toMatchObject({
      name: 'ecomm-toolkit-commercetools',
    })
  })

  it("keeps the multi-PIM carousel's commercetools list only on a commercetools hub", () => {
    const lists = listsOf(withProductPickers(multi, { commercetools: false }))
    expect(Object.keys(lists)).toEqual(['cms'])
    expect(lists.cms?.['ui:extension']).toMatchObject({ name: 'ecomm-toolkit-amplience' })
  })

  it("tabs the multi-PIM carousel's lists only when there is more than one", () => {
    const tabsOf = (schema: typeof multi) => schema.properties.products?.['ui:component']
    expect(tabsOf(withProductPickers(multi, { commercetools: true }))).toMatchObject({
      name: 'tabs',
      params: { tabs: { items: [{ pointers: ['/cms'] }, { pointers: ['/commercetools'] }] } },
    })
    expect(tabsOf(withProductPickers(multi, { commercetools: false }))).toBeUndefined()
  })

  it('does not touch the checked-in schema', () => {
    withProductPickers(multi, { commercetools: false })
    expect(Object.keys(listsOf(multi))).toEqual(['cms', 'commercetools'])
    expect(listsOf(multi).cms?.['ui:extension']).toBeUndefined()
    expect(multi.properties.products?.['ui:component']).toBeDefined()
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

describe('the commercetools eComm Toolkit extension definition', () => {
  const definition = readFileSync(
    path.join(here, '../../extensions/ecomm-toolkit-commercetools.json'),
    'utf8',
  )

  it('is recognised as needing commercetools settings', () => {
    expect(needsCommercetools(definition)).toBe(true)
  })

  it('resolves to the codec parameters the toolkit expects', () => {
    const settings = commercetoolsSettings(hub)
    const resolved = JSON.parse(
      resolveTokens(definition, {
        ...(settings && { commercetools: settings }),
        source: 'ecomm-toolkit-commercetools.json',
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
    expect(() => resolveTokens(definition, { source: 'ecomm-toolkit-commercetools.json' })).toThrow(
      /commercetools/,
    )
  })
})

describe('the Amplience PIM eComm Toolkit extension definition', () => {
  const definition = readFileSync(
    path.join(here, '../../extensions/ecomm-toolkit-amplience.json'),
    'utf8',
  )

  it('needs no commercetools settings, so every hub is seeded with it', () => {
    expect(needsCommercetools(definition)).toBe(false)
  })

  it('carries the parameters the toolkit expects', () => {
    const { parameters } = JSON.parse(definition) as { parameters: string }
    expect(JSON.parse(parameters)).toEqual({
      vendor: 'amplience',
      productSchemaUri: 'https://quadratic.amplience.com/v2/content/product',
    })
  })
})

describe('the toolkit extensions and the pickers that use them', () => {
  const definitionNamed = (file: string) =>
    JSON.parse(readFileSync(path.join(here, '../../extensions', file), 'utf8')) as {
      name: string
      url: string
    }
  const definitions = [
    definitionNamed('ecomm-toolkit-commercetools.json'),
    definitionNamed('ecomm-toolkit-amplience.json'),
  ]
  const pickerName = (field: Record<string, unknown> | undefined) =>
    (field?.['ui:extension'] as { name: string } | undefined)?.name
  const picked = (commercetools: boolean) => ({
    carousel: pickerName(withProductPickers(carousel, { commercetools }).properties.products),
    cms: pickerName(listsOf(withProductPickers(multi, { commercetools })).cms),
    commercetools: pickerName(listsOf(withProductPickers(multi, { commercetools })).commercetools),
  })

  // A picker naming an extension that is never seeded would render as a broken
  // field in the editor, so the two sides are checked against each other.
  it('has an extension definition for every picker a schema can get', () => {
    const used = new Set(
      [...Object.values(picked(true)), ...Object.values(picked(false))].filter(Boolean),
    )
    expect([...used].sort()).toEqual(definitions.map((definition) => definition.name).sort())
  })

  it('serves both from the same extension app', () => {
    expect(new Set(definitions.map((definition) => definition.url))).toEqual(
      new Set(['https://dc-extension-ecomm-toolkit-for-afs.vercel.app/']),
    )
  })
})
