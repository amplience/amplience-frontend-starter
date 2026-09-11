import { describe, expect, it } from 'vitest'

import { deriveIdentifier, slugifyLabel } from './hub-identifier.ts'

describe('slugifyLabel', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyLabel('Client A — Staging')).toBe('client-a-staging')
  })

  it('strips emoji and punctuation', () => {
    expect(slugifyLabel("👱🏻‍♂️ Matt's Sandbox")).toBe('matt-s-sandbox')
    expect(slugifyLabel('🇦🇪Al-Taher Group')).toBe('al-taher-group')
  })

  it('returns "" when there is nothing to slugify', () => {
    expect(slugifyLabel('💠')).toBe('')
    expect(slugifyLabel('   ')).toBe('')
  })

  it('truncates without leaving a trailing hyphen', () => {
    const slug = slugifyLabel(`${'a'.repeat(59)} tail`)
    expect(slug).toBe('a'.repeat(59))
    expect(slug.length).toBeLessThanOrEqual(60)
  })
})

describe('deriveIdentifier', () => {
  it('uses the plain slug when it is free', () => {
    expect(deriveIdentifier('Amplience Frontend Starter', ['fixtures'])).toBe(
      'amplience-frontend-starter',
    )
  })

  it('suffixes on collision', () => {
    expect(deriveIdentifier('Amplience Frontend Starter', ['amplience-frontend-starter'])).toBe(
      'amplience-frontend-starter-2',
    )
    expect(
      deriveIdentifier('Amplience Frontend Starter', [
        'amplience-frontend-starter',
        'amplience-frontend-starter-2',
      ]),
    ).toBe('amplience-frontend-starter-3')
  })

  it('falls back to "hub" for an unslugifiable label', () => {
    expect(deriveIdentifier('💠', [])).toBe('hub')
    expect(deriveIdentifier('💠', ['hub'])).toBe('hub-2')
  })

  it('respects the fixtures sentinel', () => {
    expect(deriveIdentifier('Fixtures', ['fixtures'])).toBe('fixtures-2')
  })
})
