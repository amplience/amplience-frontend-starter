import { describe, expect, it } from 'vitest'

import { moveItem, replaceSite, thumbnailIndex, withoutThumbnail } from './site-order.js'
import type { WebApp } from './types.js'

const site = (url: string, thumbnail = false): WebApp => ({
  label: '',
  url,
  brand: '',
  name: '',
  ...(thumbnail ? { thumbnail: true as const } : {}),
})

describe('moveItem', () => {
  it('moves down and up', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('returns an unchanged copy for out-of-range moves', () => {
    const list = ['a', 'b']
    expect(moveItem(list, 0, 5)).toEqual(['a', 'b'])
    expect(moveItem(list, 3, 0)).toEqual(['a', 'b'])
    expect(moveItem(list, 0, -1)).toEqual(['a', 'b'])
  })
})

describe('thumbnailIndex', () => {
  it('is the flagged site, else the first, else -1', () => {
    expect(thumbnailIndex([site('a'), site('b', true)])).toBe(1)
    expect(thumbnailIndex([site('a'), site('b')])).toBe(0)
    expect(thumbnailIndex([])).toBe(-1)
  })
})

describe('withoutThumbnail', () => {
  it('drops the key rather than setting it false', () => {
    expect('thumbnail' in withoutThumbnail(site('a', true))).toBe(false)
  })
})

describe('replaceSite', () => {
  it('moves the flag to a flagged replacement', () => {
    const next = replaceSite([site('a', true), site('b')], 1, site('b', true))
    expect(next.map((s) => s.thumbnail === true)).toEqual([false, true])
  })

  it('leaves the others alone for an unflagged replacement', () => {
    const next = replaceSite([site('a', true), site('b')], 1, site('b2'))
    expect(next.map((s) => s.url)).toEqual(['a', 'b2'])
    expect(next[0]?.thumbnail).toBe(true)
  })
})
