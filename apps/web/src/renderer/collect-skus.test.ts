// Tests for the pre-pass collector (ADR-0027). It is the half of the seam that
// can be tested without a source at all — pure, synchronous, registry-driven.

import { describe, expect, it } from 'vitest'

import type { AnyComponentRegistryEntry, Registry } from '@amplience/frontend-starter-types'

import { collectSkus } from './collect-skus'
import { LOCALE_CONTENT_SCHEMA } from './locale-content'

const RAIL = 'test/rail'
const SLOT = 'test/slot'
const PLAIN = 'test/plain'

const entry = (e: Partial<AnyComponentRegistryEntry>): AnyComponentRegistryEntry => ({
  component: () => null,
  ...e,
})

const registry: Registry = new Map([
  [RAIL, entry({ referencedSkus: (s: { skus?: string[] }) => s.skus ?? [] })],
  [SLOT, entry({ getChildren: (s: { children?: unknown[] }) => s.children ?? [] })],
  [PLAIN, entry({})],
])

const rail = (...skus: string[]) => ({ _meta: { schema: RAIL }, skus })
const slot = (...children: unknown[]) => ({ _meta: { schema: SLOT }, children })

describe('collectSkus', () => {
  it('collects from a node that declares them', () => {
    expect(collectSkus(rail('A', 'B'), registry)).toEqual(['A', 'B'])
  })

  it('finds rails nested behind getChildren', () => {
    expect(collectSkus(slot(slot(rail('A'))), registry)).toEqual(['A'])
  })

  it('walks arrays of nodes', () => {
    expect(collectSkus([rail('A'), rail('B')], registry)).toEqual(['A', 'B'])
  })

  it('de-duplicates across the tree, so one call resolves a shared SKU once', () => {
    expect(collectSkus(slot(rail('A', 'B'), rail('B', 'C')), registry)).toEqual(['A', 'B', 'C'])
  })

  it('preserves first-seen order', () => {
    expect(collectSkus(slot(rail('C'), rail('A')), registry)).toEqual(['C', 'A'])
  })

  it('returns nothing for a tree with no product references', () => {
    expect(collectSkus(slot({ _meta: { schema: PLAIN } }), registry)).toEqual([])
  })

  it('ignores unregistered schemas rather than throwing', () => {
    expect(collectSkus({ _meta: { schema: 'test/unknown' }, skus: ['A'] }, registry)).toEqual([])
  })

  it('ignores nodes with no dispatch key', () => {
    expect(collectSkus({ skus: ['A'] }, registry)).toEqual([])
  })

  it('skips empty and non-string entries', () => {
    const messy = { _meta: { schema: RAIL }, skus: ['A', '', null, 7, 'B'] }
    expect(collectSkus(messy, registry)).toEqual(['A', 'B'])
  })

  it.each([null, undefined, 'a string', 42])('returns nothing for %p', (node) => {
    expect(collectSkus(node, registry)).toEqual([])
  })

  it('terminates on a self-referential tree', () => {
    // A mis-authored link can produce a cycle; the walk must not hang.
    const node: { _meta: { schema: string }; children: unknown[] } = {
      _meta: { schema: SLOT },
      children: [rail('A')],
    }
    node.children.push(node)
    expect(collectSkus(node, registry)).toEqual(['A'])
  })
})

describe('collectSkus — Locale-based Content', () => {
  // Only the variant the render will show is collected: SKUs for a rail that
  // loses would be fetched, priced and then thrown away.
  const variants = (defaultContent: unknown[], ...overrides: [string[], unknown[]?][]) => ({
    _meta: { schema: LOCALE_CONTENT_SCHEMA },
    defaultContent,
    localeOverrides: overrides.map(([locales, content]) => ({
      locales,
      ...(content !== undefined && { content }),
    })),
  })

  const tree = slot(
    rail('ALWAYS'),
    variants([rail('DEFAULT')], [['fr-FR'], [rail('FRENCH')]], [['de-DE'], [rail('GERMAN')]]),
  )

  it('collects the default variant when no locale is given', () => {
    expect(collectSkus(tree, registry)).toEqual(['ALWAYS', 'DEFAULT'])
  })

  it('collects the default variant for a locale with no override', () => {
    expect(collectSkus(tree, registry, 'en-GB')).toEqual(['ALWAYS', 'DEFAULT'])
  })

  it('collects only the matching override, not the default or the other locales', () => {
    expect(collectSkus(tree, registry, 'fr-FR')).toEqual(['ALWAYS', 'FRENCH'])
    expect(collectSkus(tree, registry, 'de-DE')).toEqual(['ALWAYS', 'GERMAN'])
  })

  it('collects nothing from a wrapper whose matching override is empty', () => {
    const hidden = slot(variants([rail('DEFAULT')], [['fr-FR']]))
    expect(collectSkus(hidden, registry, 'fr-FR')).toEqual([])
  })

  it('resolves a wrapper at the root of the tree, not only inside an array', () => {
    const root = variants([rail('DEFAULT')], [['fr-FR'], [rail('FRENCH')]])
    expect(collectSkus(root, registry, 'fr-FR')).toEqual(['FRENCH'])
    expect(collectSkus(root, registry, 'en-GB')).toEqual(['DEFAULT'])
  })
})
