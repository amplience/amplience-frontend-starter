// Unit tests for the mock's localized-value resolver (ADR-0015). Synthetic
// input — no fixture coupling — so these pin the resolution rules directly.

import { describe, expect, it } from 'vitest'

import { resolveLocalized } from './localized'
import { LOCALIZED_VALUE_SCHEMA } from './types'
import type { ContentBody } from './types'

const localized = (values: { locale: string; value: unknown }[]) => ({
  values,
  _meta: { schema: LOCALIZED_VALUE_SCHEMA },
})

const body = (fields: Record<string, unknown>): ContentBody => ({
  _meta: { schema: 'https://example/test' },
  ...fields,
})

const enFr = localized([
  { locale: 'en-US', value: 'Hello' },
  { locale: 'fr-FR', value: 'Bonjour' },
])

/** Read a field off the resolved body without fighting the `ContentBody` type. */
const field = (out: ContentBody, key: string): unknown => (out as Record<string, unknown>)[key]

describe('resolveLocalized', () => {
  it('picks the exact locale match', () => {
    expect(field(resolveLocalized(body({ title: enFr }), 'fr-FR,en-US,*'), 'title')).toBe('Bonjour')
  })

  it('falls through the preference list to the next available locale', () => {
    // No de-DE value → falls to en-US.
    expect(field(resolveLocalized(body({ title: enFr }), 'de-DE,en-US,*'), 'title')).toBe('Hello')
  })

  it('treats * as the first available value', () => {
    expect(field(resolveLocalized(body({ title: enFr }), 'de-DE,*'), 'title')).toBe('Hello')
  })

  it('resolves to undefined when nothing matches and there is no wildcard', () => {
    expect(field(resolveLocalized(body({ title: enFr }), 'de-DE'), 'title')).toBeUndefined()
  })

  it('leaves non-localized fields untouched', () => {
    const out = resolveLocalized(body({ title: enFr, count: 3, flag: true }), 'en-US,*')
    expect(field(out, 'count')).toBe(3)
    expect(field(out, 'flag')).toBe(true)
  })

  it('resolves localized values nested in arrays and objects', () => {
    const input = body({
      ctas: [{ label: enFr, href: '/x' }],
      nested: { deep: enFr },
    })
    const out = resolveLocalized(input, 'fr-FR,*')
    const ctas = field(out, 'ctas') as { label: unknown; href: unknown }[]
    const nested = field(out, 'nested') as { deep: unknown }
    expect(ctas[0]?.label).toBe('Bonjour')
    expect(ctas[0]?.href).toBe('/x')
    expect(nested.deep).toBe('Bonjour')
  })
})
