// Locale-config unit tests (ADR-0015). Pure functions, no DOM, no client.
//
// `resolveLocales` is tested directly with env objects (the same shape the
// module reads from `process.env` at load) so multi-locale behaviour is
// checkable without stubbing the environment. The slug/publicPath helpers
// bound to the module's resolved config are covered against the zero-config
// default (en-US), which is what the test environment resolves to.

import { describe, expect, it } from 'vitest'

import {
  canonicalLocaleSlug,
  DEFAULT_LOCALE_CODE,
  defaultLocale,
  isLocaleSlug,
  localeBasePath,
  localeForSlug,
  localeLabel,
  publicPath,
  resolveLocales,
} from './locales'

describe('resolveLocales', () => {
  it('falls back to a single en-US default with no locale env', () => {
    const { locales, defaultLocale: def } = resolveLocales({})
    expect(locales).toEqual([{ code: 'en-US', slug: 'en-us', delivery: 'en-US,*' }])
    expect(def.code).toBe(DEFAULT_LOCALE_CODE)
  })

  it('reads a comma-separated list, first entry is the default', () => {
    const { locales, defaultLocale: def } = resolveLocales({
      AMPLIENCE_LOCALES: 'en-GB,fr-FR,de-DE',
    })
    expect(locales.map((l) => l.code)).toEqual(['en-GB', 'fr-FR', 'de-DE'])
    expect(def.code).toBe('en-GB')
  })

  it('derives slug and delivery form for each locale', () => {
    const { locales } = resolveLocales({ AMPLIENCE_LOCALES: 'fr-FR' })
    expect(locales[0]).toEqual({ code: 'fr-FR', slug: 'fr-fr', delivery: 'fr-FR,*' })
  })

  it('falls a non-default locale back to the default, then wildcard', () => {
    // Field-level localization: a field authored only in the default locale
    // should resolve to it under a non-default request, not vanish.
    const { locales } = resolveLocales({ AMPLIENCE_LOCALES: 'en-US,fr-FR,de-DE' })
    expect(locales.map((l) => l.delivery)).toEqual(['en-US,*', 'fr-FR,en-US,*', 'de-DE,en-US,*'])
  })

  it('trims whitespace and ignores empty entries', () => {
    const { locales } = resolveLocales({ AMPLIENCE_LOCALES: ' en-GB , , fr-FR ' })
    expect(locales.map((l) => l.code)).toEqual(['en-GB', 'fr-FR'])
  })

  it('falls back to the single AMPLIENCE_LOCALE when the list is unset', () => {
    const { locales, defaultLocale: def } = resolveLocales({ AMPLIENCE_LOCALE: 'de-DE' })
    expect(locales.map((l) => l.code)).toEqual(['de-DE'])
    expect(def.code).toBe('de-DE')
  })

  it('prefers AMPLIENCE_LOCALES over AMPLIENCE_LOCALE', () => {
    const { defaultLocale: def } = resolveLocales({
      AMPLIENCE_LOCALES: 'fr-FR',
      AMPLIENCE_LOCALE: 'de-DE',
    })
    expect(def.code).toBe('fr-FR')
  })

  it('accepts a bare language code', () => {
    const { locales } = resolveLocales({ AMPLIENCE_LOCALES: 'en' })
    expect(locales[0]).toEqual({ code: 'en', slug: 'en', delivery: 'en,*' })
  })

  it('throws loudly on a malformed locale code, naming the value', () => {
    expect(() => resolveLocales({ AMPLIENCE_LOCALES: 'en_GB' })).toThrow(/en_GB/)
    expect(() => resolveLocales({ AMPLIENCE_LOCALES: 'english' })).toThrow(/english/)
  })

  it('throws on a duplicate locale (case-insensitive slug clash)', () => {
    expect(() => resolveLocales({ AMPLIENCE_LOCALES: 'en-GB,en-GB' })).toThrow(/more than once/)
  })

  it('throws when the list is present but empty after trimming', () => {
    expect(() => resolveLocales({ AMPLIENCE_LOCALES: ' , ' })).toThrow(/empty/)
  })
})

describe('slug helpers (module default config = en-US)', () => {
  it('recognises the default locale slug and rejects others', () => {
    expect(isLocaleSlug(defaultLocale.slug)).toBe(true)
    expect(isLocaleSlug('fr-fr')).toBe(false)
    expect(isLocaleSlug('about')).toBe(false)
  })

  it('resolves a known slug to its locale, undefined otherwise', () => {
    expect(localeForSlug('en-us')?.code).toBe('en-US')
    expect(localeForSlug('fr-fr')).toBeUndefined()
  })

  it('canonicalizes any casing of a known locale to its lowercase slug', () => {
    expect(canonicalLocaleSlug('en-us')).toBe('en-us')
    expect(canonicalLocaleSlug('EN-US')).toBe('en-us')
    expect(canonicalLocaleSlug('En-Us')).toBe('en-us')
    expect(canonicalLocaleSlug('fr-fr')).toBeUndefined()
    expect(canonicalLocaleSlug('about')).toBeUndefined()
  })
})

describe('localeBasePath', () => {
  it('is empty for the default locale and a slug prefix otherwise', () => {
    const { locales } = resolveLocales({ AMPLIENCE_LOCALES: 'en-US,fr-FR' })
    const [def, fr] = locales
    // Module default is en-US, so an en-US locale is the default here.
    expect(localeBasePath(def!)).toBe('')
    expect(localeBasePath(fr!)).toBe('/fr-fr')
  })
})

describe('localeLabel', () => {
  it('appends the region code to disambiguate regional variants', () => {
    const [enGb] = resolveLocales({ AMPLIENCE_LOCALES: 'en-GB' }).locales
    const label = localeLabel(enGb!)
    expect(label).toMatch(/\(GB\)$/)
    expect(label.length).toBeGreaterThan(4)
  })

  it('omits the region for a bare language code', () => {
    const [en] = resolveLocales({ AMPLIENCE_LOCALES: 'en' }).locales
    expect(localeLabel(en!)).not.toContain('(')
  })
})

describe('publicPath', () => {
  it('leaves the default locale unprefixed', () => {
    expect(publicPath(defaultLocale, '/about')).toBe('/about')
    expect(publicPath(defaultLocale, '/')).toBe('/')
  })

  it('prefixes a non-default locale with its slug', () => {
    // `fr-fr` is non-default relative to the module's en-US default.
    const fr = resolveLocales({ AMPLIENCE_LOCALES: 'en-US,fr-FR' }).locales.find(
      (l) => l.slug === 'fr-fr',
    )
    if (fr === undefined) throw new Error('expected fr-FR locale')
    expect(publicPath(fr, '/about')).toBe('/fr-fr/about')
    expect(publicPath(fr, '/')).toBe('/fr-fr')
  })
})
