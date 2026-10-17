import { describe, expect, it } from 'vitest'

import { fillLocaleGaps } from './fill-locale-gaps'

const hero = (id: string, title: string | null, label: string | null) => ({
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/hero', deliveryId: id },
  title,
  ctas: [{ label, href: '/x' }],
})

describe('fillLocaleGaps', () => {
  it('fills null localized fields from the server model', () => {
    const live = hero('a', null, null)
    const server = hero('a', 'Upptäck', 'Shoppa')
    expect(fillLocaleGaps(live, server)).toEqual(server)
  })

  it('keeps live values that are present (unsaved edits win)', () => {
    const live = hero('a', 'Edited', null)
    const server = hero('a', 'Saved', 'Shoppa')
    expect(fillLocaleGaps(live, server)).toEqual(hero('a', 'Edited', 'Shoppa'))
  })

  it('matches nested items by deliveryId, so reordering still lines up', () => {
    const live = { components: [hero('b', null, null), hero('a', null, null)] }
    const server = { components: [hero('a', 'A', 'a'), hero('b', 'B', 'b')] }
    expect(fillLocaleGaps(live, server)).toEqual({
      components: [hero('b', 'B', 'b'), hero('a', 'A', 'a')],
    })
  })

  it('leaves null in place for items the server has never seen', () => {
    const live = { components: [hero('new', null, null)] }
    expect(fillLocaleGaps(live, { components: [] })).toEqual(live)
  })

  it('does not invent keys the live model dropped', () => {
    const server = hero('a', 'A', 'a')
    const { ctas: _dropped, ...live } = server
    expect(fillLocaleGaps({ ...live, title: null }, server)).toEqual(live)
  })
})
