// Tests for the hero contract validator (QL-37) — the worked example of the
// renderer-edge `validate` surface (ADR-0009 §10, ADR-0010 §7).

import { describe, expect, it } from 'vitest'

import { validateHeroBlockSchema } from './HeroBlock.registry'

const validHero = {
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/hero' },
  title: 'Build composable sites without the boilerplate.',
  subtitle: 'Optional fields are fine.',
}

describe('validateHeroBlockSchema', () => {
  it('accepts a delivery body with a non-empty title', () => {
    expect(validateHeroBlockSchema(validHero)).toBe(true)
  })

  it('rejects a body with no title', () => {
    const { title: _title, ...withoutTitle } = validHero
    expect(validateHeroBlockSchema(withoutTitle)).toBe(false)
  })

  it('rejects an empty or whitespace-only title', () => {
    expect(validateHeroBlockSchema({ ...validHero, title: '' })).toBe(false)
    expect(validateHeroBlockSchema({ ...validHero, title: '   ' })).toBe(false)
  })

  it('rejects a non-string title', () => {
    expect(validateHeroBlockSchema({ ...validHero, title: 42 })).toBe(false)
  })

  it('rejects non-object input', () => {
    expect(validateHeroBlockSchema(null)).toBe(false)
    expect(validateHeroBlockSchema('hero')).toBe(false)
  })
})
