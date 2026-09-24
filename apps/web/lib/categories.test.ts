import { describe, expect, it } from 'vitest'

import { categoryIdForSlug, categoryTitle } from './categories'

describe('categoryIdForSlug', () => {
  it('is the single segment for a flat category URL', () => {
    expect(categoryIdForSlug(['mens-shirts'])).toBe('mens-shirts')
  })

  it('is null at the root — the homepage is never a category', () => {
    expect(categoryIdForSlug(undefined)).toBeNull()
    expect(categoryIdForSlug([])).toBeNull()
  })

  it('joins deeper paths the same way delivery keys do', () => {
    // Not because nested category URLs exist (ADR-0024 §4 makes them flat),
    // but so one URL has one relative form whichever resolver looks at it.
    expect(categoryIdForSlug(['a', 'b'])).toBe('a/b')
  })
})

describe('categoryTitle', () => {
  it('title-cases a hyphenated identifier', () => {
    expect(categoryTitle('mens-shirts')).toBe('Mens Shirts')
  })

  it('leaves a single word alone but capitalised', () => {
    expect(categoryTitle('home')).toBe('Home')
  })

  it('does not choke on empty segments', () => {
    expect(categoryTitle('a--b')).toBe('A B')
  })

  it('formats an opaque identifier without pretending to understand it', () => {
    // A PIM identifier carries no words; the result is ugly, which is correct
    // — the fix is an override page, not cleverer parsing (ADR-0024 §9).
    expect(categoryTitle('cat_0042')).toBe('Cat_0042')
  })
})
