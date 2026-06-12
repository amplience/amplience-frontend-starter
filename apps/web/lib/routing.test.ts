// Route-mapping unit tests (QL-76). Pure functions, no DOM, no client.

import { describe, expect, it } from 'vitest'

import {
  deliveryKeyForSlug,
  HOMEPAGE_DELIVERY_KEY,
  pathForDeliveryKey,
  RESERVED_DELIVERY_KEYS,
} from './routing'

describe('deliveryKeyForSlug', () => {
  it('maps the root path (undefined slug) to the homepage key', () => {
    expect(deliveryKeyForSlug(undefined)).toBe(HOMEPAGE_DELIVERY_KEY)
  })

  it('maps an empty slug array to the homepage key', () => {
    expect(deliveryKeyForSlug([])).toBe(HOMEPAGE_DELIVERY_KEY)
  })

  it('maps a single segment to the key verbatim', () => {
    expect(deliveryKeyForSlug(['about'])).toBe('about')
  })

  it('joins nested segments with slashes', () => {
    expect(deliveryKeyForSlug(['docs', 'getting-started'])).toBe('docs/getting-started')
  })

  it.each([...RESERVED_DELIVERY_KEYS])('returns null for the reserved key "%s"', (key) => {
    expect(deliveryKeyForSlug([key])).toBeNull()
  })

  it('does not reserve keys that merely start with a reserved segment', () => {
    // 'header' is furniture; 'header/promo' or 'headers' are ordinary keys.
    expect(deliveryKeyForSlug(['header', 'promo'])).toBe('header/promo')
    expect(deliveryKeyForSlug(['headers'])).toBe('headers')
  })
})

describe('pathForDeliveryKey', () => {
  it('maps the homepage key to the root path', () => {
    expect(pathForDeliveryKey(HOMEPAGE_DELIVERY_KEY)).toBe('/')
  })

  it('prefixes other keys with a slash', () => {
    expect(pathForDeliveryKey('about')).toBe('/about')
    expect(pathForDeliveryKey('docs/getting-started')).toBe('/docs/getting-started')
  })
})
