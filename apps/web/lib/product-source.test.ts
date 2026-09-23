import { describe, expect, it } from 'vitest'

import { resolveSourceName } from './product-source'

describe('resolveSourceName', () => {
  it('defaults to the CMS source when unset', () => {
    // The property the whole ADR rests on: a clone with no .env has products.
    expect(resolveSourceName(undefined)).toBe('cms')
  })

  it('treats an empty or whitespace value as unset', () => {
    expect(resolveSourceName('')).toBe('cms')
    expect(resolveSourceName('   ')).toBe('cms')
  })

  it('accepts an explicit cms', () => {
    expect(resolveSourceName('cms')).toBe('cms')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(resolveSourceName(' CMS ')).toBe('cms')
  })

  it('throws on an unrecognised source rather than falling back', () => {
    // A typo in a future PIM deployment must fail at boot, not degrade to an
    // empty CMS catalogue that reads as "no products published".
    expect(() => resolveSourceName('commercetools')).toThrow(/not a known product source/)
    expect(() => resolveSourceName('cmss')).toThrow(/Expected one of: cms/)
  })
})
