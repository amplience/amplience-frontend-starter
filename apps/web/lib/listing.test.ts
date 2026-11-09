import { describe, expect, it } from 'vitest'

import { resolveListingLimit } from './listing'

describe('resolveListingLimit', () => {
  it('defaults to one page of 48', () => {
    expect(resolveListingLimit(undefined)).toBe(48)
    expect(resolveListingLimit('  ')).toBe(48)
  })

  it('reads an explicit limit', () => {
    expect(resolveListingLimit('24')).toBe(24)
  })

  it('treats 0 as no limit', () => {
    expect(resolveListingLimit('0')).toBeUndefined()
  })

  it('ignores nonsense rather than failing', () => {
    expect(resolveListingLimit('lots')).toBe(48)
    expect(resolveListingLimit('-3')).toBe(48)
    expect(resolveListingLimit('2.5')).toBe(48)
  })
})
