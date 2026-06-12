// Tests for content-link resolution (QL-40) — the guard-rail paths.
//
// The happy path (stubs replaced by referenced bodies) is exercised through
// MockContentClient.test.ts; what's pinned here is the resolver's two
// leave-the-stub-in-place decisions: unresolved references and cycles.
// Both fall through to the renderer's loud-failure mode (ADR-0010) instead
// of throwing or recursing forever.

import { describe, expect, it } from 'vitest'

import { CONTENT_LINK_SCHEMA, type ContentBody, type EnrichedContentItem } from '../types'
import { resolveDeep } from './resolver'

const link = (id: string) => ({
  id,
  contentType: 'https://quadratic.amplience.com/v2/content/hero',
  _meta: { schema: CONTENT_LINK_SCHEMA },
})

const item = (id: string, body: Record<string, unknown>): EnrichedContentItem => ({
  id,
  body: body as ContentBody,
})

describe('resolveDeep guard rails', () => {
  it('leaves an unresolved reference stub in place', () => {
    const body = {
      _meta: { schema: 'https://quadratic.amplience.com/v2/page' },
      hero: link('missing-id'),
    } as ContentBody
    const out = resolveDeep(body, () => undefined) as Record<string, unknown>
    expect(out.hero).toEqual(link('missing-id'))
  })

  it('leaves the stub in place when an item references itself', () => {
    const a = item('a', {
      _meta: { schema: 'https://quadratic.amplience.com/v2/content/columns' },
      child: link('a'),
    })
    const out = resolveDeep(a.body, (id) => (id === 'a' ? a : undefined)) as unknown as {
      child: { child: unknown }
    }
    // One level resolves; the second occurrence is the cycle and stays a stub.
    expect(out.child.child).toEqual(link('a'))
  })

  it('breaks mutual cycles at the first revisit', () => {
    const a = item('a', {
      _meta: { schema: 'https://quadratic.amplience.com/v2/content/a' },
      child: link('b'),
    })
    const b = item('b', {
      _meta: { schema: 'https://quadratic.amplience.com/v2/content/b' },
      child: link('a'),
    })
    const find = (id: string) => (id === 'a' ? a : id === 'b' ? b : undefined)
    const out = resolveDeep(a.body, find) as unknown as {
      child: { child: { child: unknown } }
    }
    // a → b resolves, b → a resolves, a → b again is the revisit: stub stays.
    expect(out.child.child.child).toEqual(link('b'))
  })
})
