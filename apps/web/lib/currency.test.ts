import { describe, expect, it } from 'vitest'

import { DEFAULT_CURRENCY, resolveCurrency, resolveCurrencyConfig } from './currency'

const config = (env: { PRODUCT_CURRENCIES?: string; PRODUCT_CURRENCY_DEFAULT?: string }) =>
  resolveCurrencyConfig(env)

describe('resolveCurrencyConfig', () => {
  it('parses a locale → currency list', () => {
    const { byLocale } = config({ PRODUCT_CURRENCIES: 'en-GB:GBP,de-DE:EUR' })
    expect(byLocale.get('en-GB')).toBe('GBP')
    expect(byLocale.get('de-DE')).toBe('EUR')
  })

  it('tolerates whitespace and lowercase codes', () => {
    const { byLocale } = config({ PRODUCT_CURRENCIES: ' en-GB : gbp , de-DE:eur ' })
    expect(byLocale.get('en-GB')).toBe('GBP')
    expect(byLocale.get('de-DE')).toBe('EUR')
  })

  it('maps several locales to one currency', () => {
    // "One currency, several locales" — the simplest of the three scenarios.
    const { byLocale } = config({ PRODUCT_CURRENCIES: 'de-DE:EUR,fr-FR:EUR,it-IT:EUR' })
    expect([...byLocale.values()]).toEqual(['EUR', 'EUR', 'EUR'])
  })

  it('skips malformed pairs rather than throwing', () => {
    // A typo costs that locale its mapping and falls back. Unlike
    // PRODUCT_SOURCE there is a sane thing to do without it, so taking the
    // whole site down would be the wrong trade.
    const { byLocale } = config({ PRODUCT_CURRENCIES: 'en-GB:GBP,broken,de-DE:EUROS,:USD' })
    expect(byLocale.get('en-GB')).toBe('GBP')
    expect(byLocale.has('de-DE')).toBe(false)
    expect(byLocale.size).toBe(1)
  })

  it('falls back to GBP when nothing is configured', () => {
    expect(config({}).fallback).toBe(DEFAULT_CURRENCY)
    expect(config({}).byLocale.size).toBe(0)
  })

  it('honours a configured default', () => {
    expect(config({ PRODUCT_CURRENCY_DEFAULT: 'usd' }).fallback).toBe('USD')
  })

  it('ignores a malformed default', () => {
    expect(config({ PRODUCT_CURRENCY_DEFAULT: 'dollars' }).fallback).toBe(DEFAULT_CURRENCY)
  })
})

describe('resolveCurrency', () => {
  const cfg = config({ PRODUCT_CURRENCIES: 'en-GB:GBP,de-DE:EUR', PRODUCT_CURRENCY_DEFAULT: 'USD' })

  it('maps a configured locale', () => {
    expect(resolveCurrency('en-GB', cfg)).toBe('GBP')
    expect(resolveCurrency('de-DE', cfg)).toBe('EUR')
  })

  it('falls back for an unmapped locale', () => {
    expect(resolveCurrency('it-IT', cfg)).toBe('USD')
  })

  it('works with no configuration at all', () => {
    // A clone with no env still shows its one currency.
    expect(resolveCurrency('en-GB', config({}))).toBe(DEFAULT_CURRENCY)
  })
})
