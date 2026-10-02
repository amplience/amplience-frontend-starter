import { describe, expect, it } from 'vitest'

// The reconciler is plain ESM (.mjs) shared with the hub-import script; import
// it directly so the test exercises the exact code the seed runs.
import { describeLocaleFilter, filterLocales } from './locales.mjs'

const LOCALIZED = 'http://bigcontent.io/cms/schema/v1/core#/definitions/localized-value'

const localized = (...locales: string[]) => ({
  values: locales.map((locale) => ({ locale, value: `text-${locale}` })),
  _meta: { schema: LOCALIZED },
})

// Generic so the assertions can reach into the fields they just declared.
const item = <T extends Record<string, unknown>>(fields: T) => ({
  id: 'x',
  label: 'Item',
  body: { _meta: { schema: 'https://example.com/thing' }, ...fields },
})

describe('filterLocales', () => {
  it('drops authored locales the hub does not have', () => {
    const doc = item({ title: localized('en-US', 'fr-FR', 'it-IT') })
    const result = filterLocales(doc, ['en-US', 'fr-FR'])

    expect(doc.body.title.values.map((v) => v.locale)).toEqual(['en-US', 'fr-FR'])
    expect([...result.kept].sort()).toEqual(['en-US', 'fr-FR'])
    expect([...result.dropped]).toEqual(['it-IT'])
    expect(result.changed).toBe(true)
  })

  it('leaves a hub locale the set lacks absent rather than filling it', () => {
    // Delivery resolves `de-DE,en-US,*` back to English; copying the value in
    // here would duplicate content on the hub and make an untranslated field
    // look translated in the DC UI.
    const doc = item({ title: localized('en-US') })
    filterLocales(doc, ['en-US', 'de-DE'])

    expect(doc.body.title.values.map((v) => v.locale)).toEqual(['en-US'])
  })

  it('is a no-op when every authored locale is on the hub', () => {
    const doc = item({ title: localized('en-US', 'de-DE') })
    const result = filterLocales(doc, ['en-US', 'de-DE', 'fr-FR'])

    expect(result.changed).toBe(false)
    expect(result.dropped.size).toBe(0)
  })

  it('reaches localized fields nested in arrays and objects', () => {
    const doc = item({
      ctas: [{ label: localized('en-US', 'it-IT') }],
      section: { header: { title: localized('en-US', 'it-IT') } },
    })
    filterLocales(doc, ['en-US'])

    expect(doc.body.ctas[0]?.label.values).toHaveLength(1)
    expect(doc.body.section.header.title.values).toHaveLength(1)
  })

  it('does not touch deliveryKeys, whose values carry no locale', () => {
    // Same `values` array shape, different meaning — and it has no localized
    // `_meta.schema`, which is what keeps them apart.
    const doc = {
      id: 'x',
      label: 'Item',
      body: {
        _meta: {
          schema: 'https://example.com/page',
          deliveryKeys: { values: [{ value: 'site/homepage' }] },
        },
      },
    }
    const result = filterLocales(doc, ['en-US'])

    expect(doc.body._meta.deliveryKeys.values).toEqual([{ value: 'site/homepage' }])
    expect(result.changed).toBe(false)
  })

  it('reports a field it would empty rather than seeding a blank one', () => {
    // The caller stops the run on this: the item would exist on the hub with
    // nothing to render in any locale.
    const doc = item({ title: localized('it-IT', 'es-ES') })
    const result = filterLocales(doc, ['en-US'])

    expect(result.emptied).toEqual(['.body.title'])
  })

  it('keeps a value that declares no locale', () => {
    const doc = item({
      title: { values: [{ value: 'unlabelled' }], _meta: { schema: LOCALIZED } },
    })
    const result = filterLocales(doc, ['en-US'])

    expect(doc.body.title.values).toHaveLength(1)
    expect(result.emptied).toEqual([])
  })
})

describe('describeLocaleFilter', () => {
  it('says nothing when every authored locale survived', () => {
    expect(
      describeLocaleFilter({ kept: new Set(['en-US']), dropped: new Set() }, 1),
    ).toBeUndefined()
  })

  it('names what was kept and what went', () => {
    const line = describeLocaleFilter(
      { kept: new Set(['en-US', 'fr-FR']), dropped: new Set(['it-IT', 'es-ES']) },
      4,
    )
    expect(line).toBe('kept 2 of 4 authored locales: en-US, fr-FR (dropped es-ES, it-IT)')
  })
})
