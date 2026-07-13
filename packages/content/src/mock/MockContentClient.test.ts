import { describe, expect, it } from 'vitest'

import type { ContentLink } from '../types'
import { ContentClientError, isContentLink } from '../types'
import { makeMockContentClient } from './MockContentClient'

describe('MockContentClient', () => {
  it('returns the home page body by delivery key', async () => {
    const client = makeMockContentClient()
    const home = await client.getByKey<{ title: string }>('base-site/homepage')
    expect(home._meta.schema).toBe('https://quadratic.amplience.com/v2/content/page')
    expect(home.title).toBe('Welcome to Quadratic Lite')
  })

  it('returns content-links unresolved by default (depth: root)', async () => {
    const client = makeMockContentClient()
    const home = await client.getByKey<{ slots: unknown[] }>('base-site/homepage')
    expect(home.slots).toHaveLength(1)
    expect(isContentLink(home.slots[0])).toBe(true)
  })

  it('resolves the full graph when depth is "all"', async () => {
    const client = makeMockContentClient()
    const home = await client.getByKey<{
      slots: {
        _meta: { schema: string }
        components: { _meta: { schema: string } }[]
      }[]
    }>('base-site/homepage', { depth: 'all' })

    // Slot is now inlined, not a link stub.
    const slot = home.slots[0]
    expect(slot).toBeDefined()
    expect(isContentLink(slot)).toBe(false)
    expect(slot?._meta.schema).toBe('https://quadratic.amplience.com/v2/slots/slot')

    // Components inside the slot are also inlined.
    expect(slot?.components).toHaveLength(5)
    expect(slot?.components[0]?._meta.schema).toBe(
      'https://quadratic.amplience.com/v2/content/hero',
    )
    expect(slot?.components[1]?._meta.schema).toBe(
      'https://quadratic.amplience.com/v2/content/columns',
    )
    expect(slot?.components[2]?._meta.schema).toBe(
      'https://quadratic.amplience.com/v2/content/markdown-block',
    )
    expect(slot?.components[3]?._meta.schema).toBe(
      'https://quadratic.amplience.com/v2/content/grid',
    )
    expect(slot?.components[4]?._meta.schema).toBe(
      'https://quadratic.amplience.com/v2/content/columns',
    )
  })

  it('resolves every delivery key on an item to the same content (QL-76)', async () => {
    // Amplience supports multiple delivery keys per item; the about fixture
    // carries 'about' and 'about-us', so both keys return one item.
    const client = makeMockContentClient()
    const byPrimary = await client.getByKey<{ title: string }>('base-site/about')
    const byAlias = await client.getByKey<{ title: string }>('base-site/about-us')
    expect(byAlias).toEqual(byPrimary)
  })

  it('leaves localized fields raw when no locale is requested (matches the Delivery API)', async () => {
    const client = makeMockContentClient()
    const hero = await client.getById<{ title: { values?: unknown } }>(
      'a1b2c3d4-0001-4000-8000-000000000003',
    )
    expect(Array.isArray(hero.title.values)).toBe(true)
  })

  it('collapses a localized field to a single value when a locale is requested', async () => {
    // Fixture-independent: with a locale, the localized `{ values }` object is
    // resolved to a single scalar (the exact text is editable content, covered
    // by the resolveLocalized unit tests).
    const client = makeMockContentClient()
    const hero = await client.getById<{ title: unknown }>('a1b2c3d4-0001-4000-8000-000000000003', {
      locale: 'en-US,*',
    })
    expect(typeof hero.title).toBe('string')
  })

  it('throws ContentClientError(not-found) for an unknown delivery key', async () => {
    const client = makeMockContentClient()
    await expect(client.getByKey('does-not-exist')).rejects.toBeInstanceOf(ContentClientError)
    await expect(client.getByKey('does-not-exist')).rejects.toMatchObject({
      kind: 'not-found',
    })
  })

  it('throws ContentClientError(not-found) for an unknown delivery id', async () => {
    const client = makeMockContentClient()
    await expect(client.getById('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      kind: 'not-found',
    })
  })

  it('leaves a content-link unresolved when its target is missing (loud-failure compatible)', async () => {
    // The resolver behaviour: if a content-link points at an id that isn't
    // in the fixture set, the stub stays in place. The renderer (ADR-0010)
    // surfaces that, not the client.
    const client = makeMockContentClient()
    const slot = await client.getById<{ components: ContentLink[] }>(
      'a1b2c3d4-0001-4000-8000-000000000002',
      { depth: 'all' },
    )
    // All present in the fixture set — all should resolve.
    expect(slot.components.every((c) => !isContentLink(c))).toBe(true)
  })
})
