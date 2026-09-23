import { describe, expect, it, vi } from 'vitest'

import { selectPrice, warnOnMissingCurrency } from './selectPrice'

/** `console` via globalThis — this package compiles without DOM/node types. */
const globalConsole = (globalThis as unknown as { console: { warn: (m: string) => void } }).console

const gbp = { amount: 749, currencyCode: 'GBP' }
const eur = { amount: 869, currencyCode: 'EUR' }

describe('selectPrice', () => {
  it('picks the requested currency', () => {
    expect(selectPrice([gbp, eur], 'EUR')).toEqual(eur)
  })

  it('returns the first price when no currency is requested', () => {
    // The single-currency catalogue — most of them — needs no configuration.
    expect(selectPrice([gbp, eur])).toEqual(gbp)
  })

  it('never substitutes another currency', () => {
    // The rule the whole module exists for. Showing €869 to someone who asked
    // for pounds is a commercial hazard, not a graceful degradation.
    expect(selectPrice([eur], 'GBP')).toBeUndefined()
  })

  it('returns undefined for an absent or empty price set', () => {
    expect(selectPrice(undefined, 'GBP')).toBeUndefined()
    expect(selectPrice([], 'GBP')).toBeUndefined()
  })
})

describe('warnOnMissingCurrency', () => {
  it('warns when the product has prices but not this one', () => {
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    try {
      warnOnMissingCurrency('aurora-lounge-chair', 'USD', [gbp, eur])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain('USD')
      expect(warn.mock.calls[0]?.[0]).toContain('GBP, EUR')
    } finally {
      warn.mockRestore()
    }
  })

  it('says nothing when the currency is present', () => {
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    warnOnMissingCurrency('x', 'GBP', [gbp, eur])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('says nothing for a product with no prices at all', () => {
    // "No price" is a legitimate product state (coming-soon), not a gap.
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    warnOnMissingCurrency('x', 'GBP', [])
    warnOnMissingCurrency('x', 'GBP', undefined)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('stays silent in production', () => {
    const warn = vi.spyOn(globalConsole, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'production')
    try {
      warnOnMissingCurrency('x', 'USD', [gbp])
      expect(warn).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
      warn.mockRestore()
    }
  })
})
