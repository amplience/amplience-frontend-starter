import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Plain ESM shared with hub-import.mjs; import it directly so the test
// exercises the exact code the seed runs.
import {
  availablePims,
  commercetoolsSettings,
  mainPim,
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

describe('mainPim', () => {
  it("uses the hub's own choice", () => {
    expect(mainPim({ ...hub, mainPim: 'cms' })).toBe('cms')
    expect(mainPim({ ...hub, mainPim: 'commercetools' })).toBe('commercetools')
  })

  it('falls back to commercetools when the hub has its settings, and the CMS otherwise', () => {
    expect(mainPim(hub)).toBe('commercetools')
    expect(mainPim({})).toBe('cms')
    expect(mainPim(undefined)).toBe('cms')
  })

  it('refuses commercetools without settings, rather than seeding the other picker', () => {
    expect(() => mainPim({ mainPim: 'commercetools' })).toThrow(/needs a complete "commercetools"/)
  })

  it('refuses a value that is not a product source', () => {
    expect(() => mainPim({ mainPim: 'shopify' })).toThrow(/isn't a product source/)
  })
})

describe('withProductPickers', () => {
  it("gives the carousel's products field the commercetools picker on a commercetools hub", () => {
    const picked = withProductPickers(carousel, { mainPim: 'commercetools', commercetools: true })
    expect(picked.properties.products?.['ui:extension']).toMatchObject({
      name: 'ecomm-toolkit-commercetools',
      params: { type: 'strings' },
    })
    // The field is still a list of strings, so content stays valid either way.
    expect(picked.properties.products?.type).toBe('array')
  })

  it("gives the carousel's products field the Amplience PIM picker without commercetools", () => {
    const picked = withProductPickers(carousel, { mainPim: 'cms', commercetools: false })
    expect(picked.properties.products?.['ui:extension']).toMatchObject({
      name: 'ecomm-toolkit-amplience',
      params: { type: 'strings' },
    })
    expect(picked.properties.products?.type).toBe('array')
  })

  it("follows the main PIM, not the credentials, for the carousel's picker", () => {
    // A multi-PIM demo hub: commercetools settings for its multi-PIM lists,
    // but the CMS as its main source.
    const options = { mainPim: 'cms', commercetools: true } as const
    expect(
      withProductPickers(carousel, options).properties.products?.['ui:extension'],
    ).toMatchObject({ name: 'ecomm-toolkit-amplience' })
    expect(Object.keys(listsOf(withProductPickers(multi, options)))).toEqual([
      'cms',
      'commercetools',
    ])
  })

  it("gives each multi-PIM list its own source's picker", () => {
    const lists = listsOf(
      withProductPickers(multi, { mainPim: 'commercetools', commercetools: true }),
    )
    expect(Object.keys(lists)).toEqual(['cms', 'commercetools'])
    expect(lists.cms?.['ui:extension']).toMatchObject({ name: 'ecomm-toolkit-amplience' })
    expect(lists.commercetools?.['ui:extension']).toMatchObject({
      name: 'ecomm-toolkit-commercetools',
    })
  })

  it("keeps the multi-PIM carousel's commercetools list only on a commercetools hub", () => {
    const lists = listsOf(withProductPickers(multi, { mainPim: 'cms', commercetools: false }))
    expect(Object.keys(lists)).toEqual(['cms'])
    expect(lists.cms?.['ui:extension']).toMatchObject({ name: 'ecomm-toolkit-amplience' })
  })

  it("tabs the multi-PIM carousel's lists only when there is more than one", () => {
    const tabsOf = (schema: typeof multi) => schema.properties.products?.['ui:component']
    expect(
      tabsOf(withProductPickers(multi, { mainPim: 'commercetools', commercetools: true })),
    ).toMatchObject({
      name: 'tabs',
      params: { tabs: { items: [{ pointers: ['/cms'] }, { pointers: ['/commercetools'] }] } },
    })
    expect(
      tabsOf(withProductPickers(multi, { mainPim: 'cms', commercetools: false })),
    ).toBeUndefined()
  })

  it('does not touch the checked-in schema', () => {
    withProductPickers(multi, { mainPim: 'cms', commercetools: false })
    expect(Object.keys(listsOf(multi))).toEqual(['cms', 'commercetools'])
    expect(listsOf(multi).cms?.['ui:extension']).toBeUndefined()
    expect(multi.properties.products?.['ui:component']).toBeDefined()
  })

  it('returns every other schema unchanged', () => {
    const other = { $id: 'https://quadratic.amplience.com/v2/content/hero', properties: {} }
    expect(withProductPickers(other, { mainPim: 'commercetools', commercetools: true })).toBe(other)
  })
})

describe('seedsContentType', () => {
  it('registers the multi-PIM carousel only on hubs that opt in', () => {
    expect(seedsContentType(MULTI_PIM_CONTENT_TYPE_FILE, hub)).toBe(false)
    expect(seedsContentType(MULTI_PIM_CONTENT_TYPE_FILE, { ...hub, multiPimDemo: true })).toBe(true)
    expect(seedsContentType('content_product-carousel.json', undefined)).toBe(true)
  })

  it('needs more than one PIM: a hub with only the Amplience PIM gets nothing', () => {
    expect(seedsContentType(MULTI_PIM_CONTENT_TYPE_FILE, { multiPimDemo: true })).toBe(false)
  })
})

describe('availablePims', () => {
  it('always offers the Amplience PIM, and commercetools when the hub has its settings', () => {
    expect(availablePims({})).toEqual(['cms'])
    expect(availablePims(hub)).toEqual(['cms', 'commercetools'])
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
      identifier: 'sku',
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
  const picked = (commercetools: boolean) => {
    const options = { mainPim: commercetools ? 'commercetools' : 'cms', commercetools } as const
    return {
      carousel: pickerName(withProductPickers(carousel, options).properties.products),
      cms: pickerName(listsOf(withProductPickers(multi, options)).cms),
      commercetools: pickerName(listsOf(withProductPickers(multi, options)).commercetools),
    }
  }

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
