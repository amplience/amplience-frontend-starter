// Route-mapping unit tests (QL-76, QL-131). Pure functions, no DOM, no client.

import { describe, expect, it } from 'vitest'

import {
  deliveryKeyForSlug,
  HOMEPAGE_DELIVERY_KEY,
  pathForDeliveryKey,
  RESERVED_DELIVERY_KEYS,
} from './routing'

// The functions take the site name as data (ADR-0014) — any literal works.
const SITE = 'acme'

describe('deliveryKeyForSlug', () => {
  it('maps the root path (undefined slug) to the site homepage key', () => {
    expect(deliveryKeyForSlug(SITE, undefined)).toBe(`${SITE}/${HOMEPAGE_DELIVERY_KEY}`)
  })

  it('maps an empty slug array to the site homepage key', () => {
    expect(deliveryKeyForSlug(SITE, [])).toBe(`${SITE}/${HOMEPAGE_DELIVERY_KEY}`)
  })

  it('prefixes a single segment with the site name', () => {
    expect(deliveryKeyForSlug(SITE, ['about'])).toBe('acme/about')
  })

  it('joins nested segments with slashes under the site prefix', () => {
    expect(deliveryKeyForSlug(SITE, ['docs', 'getting-started'])).toBe('acme/docs/getting-started')
  })

  it('namespaces the same path differently per site', () => {
    expect(deliveryKeyForSlug('acme', ['about'])).toBe('acme/about')
    expect(deliveryKeyForSlug('anyafinn', ['about'])).toBe('anyafinn/about')
  })

  it.each([...RESERVED_DELIVERY_KEYS])('returns null for the reserved key "%s"', (key) => {
    expect(deliveryKeyForSlug(SITE, [key])).toBeNull()
  })

  it('does not reserve keys that merely start with a reserved segment', () => {
    // 'header' is furniture; 'header/promo' or 'headers' are ordinary keys.
    expect(deliveryKeyForSlug(SITE, ['header', 'promo'])).toBe('acme/header/promo')
    expect(deliveryKeyForSlug(SITE, ['headers'])).toBe('acme/headers')
  })
})

describe('pathForDeliveryKey', () => {
  it('maps the site homepage key to the root path', () => {
    expect(pathForDeliveryKey(SITE, `${SITE}/${HOMEPAGE_DELIVERY_KEY}`)).toBe('/')
  })

  it('strips the site prefix — the namespace never surfaces in URLs', () => {
    expect(pathForDeliveryKey(SITE, 'acme/about')).toBe('/about')
    expect(pathForDeliveryKey(SITE, 'acme/docs/getting-started')).toBe('/docs/getting-started')
  })

  it('round-trips whatever deliveryKeyForSlug produced', () => {
    const key = deliveryKeyForSlug(SITE, ['docs', 'getting-started'])
    expect(pathForDeliveryKey(SITE, key ?? '')).toBe('/docs/getting-started')
  })

  it("throws on a key outside the site's namespace", () => {
    // Namespace isolation (ADR-0014): another site's key has no URL here,
    // and reaching this function with one is a programming error.
    expect(() => pathForDeliveryKey(SITE, 'anyafinn/homepage')).toThrow(/namespace/)
  })

  it('does not treat a sibling site name sharing a prefix as this site', () => {
    // 'acme-store/…' must not pass an 'acme' prefix check — the comparison
    // is against the full literal segment, not a substring.
    expect(() => pathForDeliveryKey(SITE, 'acme-store/about')).toThrow(/namespace/)
  })
})
