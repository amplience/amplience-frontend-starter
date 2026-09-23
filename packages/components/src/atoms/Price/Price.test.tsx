// @vitest-environment jsdom
//
// Price atom — formatting is the whole component, so the tests are about
// what `Intl` does with each locale/currency pair rather than about markup.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { formatPrice, Price } from './Price'

afterEach(cleanup)

describe('Price', () => {
  it('renders a <data> element carrying the raw amount', () => {
    render(<Price data-testid="p" amount={749} currencyCode="GBP" locale="en-GB" />)
    const el = screen.getByTestId('p')
    expect(el.tagName).toBe('DATA')
    expect(el.getAttribute('value')).toBe('749')
  })

  it('formats in the given locale', () => {
    render(<Price data-testid="p" amount={749} currencyCode="GBP" locale="en-GB" />)
    expect(screen.getByTestId('p').textContent).toBe('£749.00')
  })

  it('places the symbol per locale, not per currency', () => {
    // Same currency, different locale — the symbol moves and the separators
    // swap. This is the reason formatting isn't done in content.
    expect(formatPrice(1234.5, 'EUR', 'en-GB')).toContain('€')
    expect(formatPrice(1234.5, 'EUR', 'de-DE').endsWith('€')).toBe(true)
  })

  it('respects each currency’s minor-unit count', () => {
    // Asserting decimal places rather than the exact string: the symbol a
    // locale picks for a foreign currency ("JP¥" in en-GB) is CLDR data that
    // shifts between ICU versions, whereas the minor-unit count is the
    // property the component exists to get right.
    expect(formatPrice(749, 'JPY', 'en-GB')).not.toContain('.')
    expect(formatPrice(749, 'GBP', 'en-GB')).toBe('£749.00')
    expect(formatPrice(749, 'BHD', 'en-GB')).toContain('749.000')
  })

  it('renders zero as a price rather than nothing', () => {
    render(<Price data-testid="p" amount={0} currencyCode="GBP" locale="en-GB" />)
    expect(screen.getByTestId('p').textContent).toBe('£0.00')
  })

  it('degrades to amount + code for a currency Intl rejects', () => {
    // A mistyped currency in content shouldn't take out the page.
    expect(formatPrice(749, 'NOTACODE', 'en-GB')).toBe('749 NOTACODE')
  })

  it('carries its theming hook and forwards a className', () => {
    render(<Price data-testid="p" amount={1} currencyCode="GBP" className="custom" />)
    const { className } = screen.getByTestId('p')
    expect(className).toContain('Price')
    expect(className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(<Price data-testid="p" amount={1} currencyCode="GBP" aria-label="price" />)
    expect(screen.getByTestId('p').getAttribute('aria-label')).toBe('price')
  })
})
