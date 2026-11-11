// Tests for Locale-based Content selection (item-level localisation). Pure and
// synchronous, so they need no registry or renderer — synthetic nodes only.

import { describe, expect, it } from 'vitest'

import {
  isLocaleContent,
  LOCALE_CONTENT_SCHEMA,
  resolveLocaleContent,
  selectLocaleContent,
} from './locale-content'

const block = (name: string) => ({ _meta: { schema: 'test/block' }, name })
const wrapper = (
  defaultContent: unknown,
  localeOverrides?: unknown,
): Parameters<typeof selectLocaleContent>[0] => ({
  _meta: { schema: LOCALE_CONTENT_SCHEMA },
  ...(defaultContent !== undefined && { defaultContent }),
  ...(localeOverrides !== undefined && { localeOverrides }),
})
const override = (locales: unknown, content?: unknown) => ({
  locales,
  ...(content !== undefined && { content }),
})

const DEFAULT = [block('default')]
const FRENCH = [block('french')]
const GERMAN = [block('german')]

describe('isLocaleContent', () => {
  it('recognises the wrapper by its schema URI', () => {
    expect(isLocaleContent(wrapper(DEFAULT))).toBe(true)
  })

  it('rejects other blocks, arrays and non-objects', () => {
    expect(isLocaleContent(block('x'))).toBe(false)
    expect(isLocaleContent([wrapper(DEFAULT)])).toBe(false)
    expect(isLocaleContent(null)).toBe(false)
    expect(isLocaleContent('locale-content')).toBe(false)
    expect(isLocaleContent({})).toBe(false)
  })
})

describe('selectLocaleContent', () => {
  const node = wrapper(DEFAULT, [override(['fr-FR'], FRENCH), override(['de-DE', 'de-AT'], GERMAN)])

  it('returns the default content when no override matches', () => {
    expect(selectLocaleContent(node, 'en-GB')).toBe(DEFAULT)
  })

  it('returns the matching override instead of the default, not as well as it', () => {
    expect(selectLocaleContent(node, 'fr-FR')).toBe(FRENCH)
  })

  it('matches any of an override’s locales', () => {
    expect(selectLocaleContent(node, 'de-DE')).toBe(GERMAN)
    expect(selectLocaleContent(node, 'de-AT')).toBe(GERMAN)
  })

  it('compares case-insensitively, so an editor typing fr-fr still matches', () => {
    expect(selectLocaleContent(wrapper(DEFAULT, [override(['fr-fr'], FRENCH)]), 'fr-FR')).toBe(
      FRENCH,
    )
  })

  it('matches exactly: a language-only code does not cover a regional locale', () => {
    expect(selectLocaleContent(wrapper(DEFAULT, [override(['fr'], FRENCH)]), 'fr-CA')).toBe(DEFAULT)
    expect(selectLocaleContent(wrapper(DEFAULT, [override(['fr-CA'], FRENCH)]), 'fr')).toBe(DEFAULT)
  })

  it('uses the first matching override when several match', () => {
    const first = [block('first')]
    const second = [block('second')]
    const both = wrapper(DEFAULT, [override(['fr-FR'], first), override(['fr-FR'], second)])
    expect(selectLocaleContent(both, 'fr-FR')).toBe(first)
  })

  it('shows the default content when there is no active locale', () => {
    expect(selectLocaleContent(node, undefined)).toBe(DEFAULT)
  })

  it('treats an override with no content as an instruction to hide', () => {
    // Delivery omits an empty array field, so this is what "leave empty" looks
    // like on the wire — and it must not fall through to the default.
    expect(selectLocaleContent(wrapper(DEFAULT, [override(['fr-FR'])]), 'fr-FR')).toEqual([])
    expect(selectLocaleContent(wrapper(DEFAULT, [override(['fr-FR'], [])]), 'fr-FR')).toEqual([])
  })

  it('treats absent default content as empty', () => {
    expect(selectLocaleContent(wrapper(undefined, [override(['fr-FR'], FRENCH)]), 'en-GB')).toEqual(
      [],
    )
  })

  it('tolerates malformed overrides rather than throwing', () => {
    const malformed = wrapper(DEFAULT, [
      null,
      override(undefined, FRENCH),
      override('fr-FR', FRENCH),
      override([42, null], FRENCH),
    ])
    expect(selectLocaleContent(malformed, 'fr-FR')).toBe(DEFAULT)
    expect(selectLocaleContent(wrapper(DEFAULT, 'not-an-array'), 'fr-FR')).toBe(DEFAULT)
  })
})

describe('resolveLocaleContent', () => {
  it('returns the same array, untouched, when it holds no wrapper', () => {
    const nodes = [block('a'), block('b')]
    expect(resolveLocaleContent(nodes, 'fr-FR')).toBe(nodes)
  })

  it('splices the selected blocks in where the wrapper stood', () => {
    const nodes = [block('before'), wrapper(DEFAULT, [override(['fr-FR'], FRENCH)]), block('after')]
    expect(resolveLocaleContent(nodes, 'fr-FR')).toEqual([
      block('before'),
      ...FRENCH,
      block('after'),
    ])
    expect(resolveLocaleContent(nodes, 'en-GB')).toEqual([
      block('before'),
      ...DEFAULT,
      block('after'),
    ])
  })

  it('removes a wrapper that selects nothing', () => {
    const nodes = [block('before'), wrapper(DEFAULT, [override(['fr-FR'])]), block('after')]
    expect(resolveLocaleContent(nodes, 'fr-FR')).toEqual([block('before'), block('after')])
  })

  it('resolves a wrapper nested inside the content a wrapper selects', () => {
    const inner = wrapper([block('inner-default')], [override(['fr-FR'], [block('inner-french')])])
    const outer = wrapper([inner])
    expect(resolveLocaleContent([outer], 'fr-FR')).toEqual([block('inner-french')])
    expect(resolveLocaleContent([outer], 'en-GB')).toEqual([block('inner-default')])
  })

  it('passes unresolved content-link stubs through for the renderer to fail on', () => {
    const stub = { id: 'x', contentType: 'test/block', _meta: { schema: 'core#content-link' } }
    expect(resolveLocaleContent([wrapper([stub])], 'en-GB')).toEqual([stub])
  })
})
