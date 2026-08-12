import { describe, expect, it } from 'vitest'

import { filterEnvironments, matchesQuery } from './filter-environments.js'
import type { Environment } from './types.js'
import { EMPTY_ENV } from './types.js'

const env = (over: Partial<Environment>): Environment => ({ ...EMPTY_ENV, ...over })

const QUADRATIC = env({
  label: 'Quadratic Lite Demo',
  name: 'quadraticlite',
  hubName: 'quadraticlite',
  defaultBrand: 'quadratic',
})

const ACME = env({
  label: 'Acme Fashion',
  name: 'acmefashion',
  hubName: 'acme-fashion-hub',
  defaultBrand: 'acme',
})

const NORDIC = env({
  label: 'Nordic Outdoors',
  name: 'nordic',
  hubName: 'nordic',
  defaultBrand: 'nordic',
})

const ALL = [QUADRATIC, ACME, NORDIC]

describe('matchesQuery', () => {
  it('matches every hub when the query is empty', () => {
    expect(matchesQuery(ACME, '')).toBe(true)
  })

  it('treats a whitespace-only query as empty', () => {
    expect(matchesQuery(ACME, '   ')).toBe(true)
  })

  it('matches on label', () => {
    expect(matchesQuery(ACME, 'Fashion')).toBe(true)
  })

  it('matches on identifier', () => {
    expect(matchesQuery(ACME, 'acmefashion')).toBe(true)
  })

  it('matches on hub name', () => {
    expect(matchesQuery(ACME, 'fashion-hub')).toBe(true)
  })

  it('matches on brand', () => {
    expect(matchesQuery(QUADRATIC, 'quadratic')).toBe(true)
  })

  it('is case-insensitive in both directions', () => {
    expect(matchesQuery(ACME, 'ACME')).toBe(true)
    expect(matchesQuery(env({ label: 'ACME' }), 'acme')).toBe(true)
  })

  it('ignores surrounding whitespace in the query', () => {
    expect(matchesQuery(ACME, '  fashion  ')).toBe(true)
  })

  it('matches a substring mid-word, not just a prefix', () => {
    expect(matchesQuery(QUADRATIC, 'ratic')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(matchesQuery(ACME, 'zzz')).toBe(false)
  })

  it('does not match fields outside the four searchable ones', () => {
    const withSecrets = env({
      label: 'Visible',
      name: 'visible',
      hubName: 'visible',
      defaultBrand: 'visible',
      hubId: 'secret-hub-id',
      clientId: 'secret-client-id',
      stagingHost: 'secret.staging.bigcontent.io',
    })
    expect(matchesQuery(withSecrets, 'secret')).toBe(false)
  })

  it('does not match on site URLs', () => {
    const withSite = env({
      label: 'Site owner',
      webApps: [{ label: 'Web', url: 'https://example.vercel.app', brand: 'b', name: 'n' }],
    })
    expect(matchesQuery(withSite, 'vercel.app')).toBe(false)
  })

  it('treats an empty searchable field as a non-match rather than a wildcard', () => {
    expect(matchesQuery(env({ label: '', name: '', hubName: '', defaultBrand: '' }), 'a')).toBe(
      false,
    )
  })

  it('does not treat the query as a regular expression', () => {
    // '.' would match any character if the query were compiled as a pattern.
    expect(matchesQuery(env({ label: 'abc' }), 'a.c')).toBe(false)
    expect(matchesQuery(env({ label: 'a.c' }), 'a.c')).toBe(true)
  })

  it('handles regex metacharacters without throwing', () => {
    for (const q of ['(', '[', '\\', '*', '+?', '(?<']) {
      expect(() => matchesQuery(ACME, q)).not.toThrow()
      expect(matchesQuery(ACME, q)).toBe(false)
    }
  })
})

describe('filterEnvironments', () => {
  it('returns the original array reference when the query is empty', () => {
    expect(filterEnvironments(ALL, '')).toBe(ALL)
  })

  it('returns the original array reference when the query is whitespace', () => {
    expect(filterEnvironments(ALL, '  ')).toBe(ALL)
  })

  it('narrows to the matching hubs', () => {
    expect(filterEnvironments(ALL, 'nordic')).toEqual([NORDIC])
  })

  it('can match more than one hub', () => {
    expect(filterEnvironments(ALL, 'a')).toEqual([QUADRATIC, ACME])
  })

  it('preserves the original order', () => {
    const reordered = filterEnvironments([NORDIC, ACME, QUADRATIC], 'a')
    expect(reordered).toEqual([ACME, QUADRATIC])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterEnvironments(ALL, 'zzz')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [...ALL]
    filterEnvironments(input, 'nordic')
    expect(input).toEqual(ALL)
  })

  it('handles an empty hub list', () => {
    expect(filterEnvironments([], 'anything')).toEqual([])
  })
})
