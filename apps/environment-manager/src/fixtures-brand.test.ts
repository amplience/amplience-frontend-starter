import { describe, expect, it } from 'vitest'

import { DEFAULT_BRAND, resolveFixturesBrand } from './fixtures-brand.js'

describe('resolveFixturesBrand', () => {
  it('returns a saved brand unchanged', () => {
    expect(resolveFixturesBrand('acme')).toBe('acme')
  })

  it('trims surrounding whitespace so the badge matches what gets written', () => {
    expect(resolveFixturesBrand('  acme  ')).toBe('acme')
  })

  it.each([
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['undefined (config written before fixtures had a brand)', undefined],
  ])('falls back to the default brand for %s', (_label, input) => {
    expect(resolveFixturesBrand(input)).toBe(DEFAULT_BRAND)
  })

  it('leaves an explicit "default" alone', () => {
    expect(resolveFixturesBrand(DEFAULT_BRAND)).toBe(DEFAULT_BRAND)
  })
})
