import { describe, expect, it } from 'vitest'

import { canonicalGroup, groupHubs, groupNames, reorderWithin } from './hub-groups.js'
import type { Environment } from './types.js'
import { EMPTY_ENV } from './types.js'

const hub = (name: string, group?: string): Environment => ({
  ...EMPTY_ENV,
  name,
  ...(group === undefined ? {} : { group }),
})

describe('groupHubs', () => {
  it('returns one unlabelled section when no hub is grouped', () => {
    const hubs = [hub('a'), hub('b')]
    expect(groupHubs(hubs)).toEqual([{ group: null, hubs }])
  })

  it('orders groups by first appearance and puts ungrouped hubs last', () => {
    const sections = groupHubs([
      hub('a'),
      hub('b', 'Prospects'),
      hub('c', 'Customers'),
      hub('d', 'Prospects'),
    ])
    expect(sections.map((s) => [s.group, s.hubs.map((h) => h.name)])).toEqual([
      ['Prospects', ['b', 'd']],
      ['Customers', ['c']],
      [null, ['a']],
    ])
  })

  it('treats a blank group as ungrouped', () => {
    expect(groupHubs([hub('a', '  '), hub('b', 'X')]).map((s) => s.group)).toEqual(['X', null])
  })

  it('handles an empty list', () => {
    expect(groupHubs([])).toEqual([{ group: null, hubs: [] }])
  })
})

describe('groupNames', () => {
  it('lists distinct groups in order', () => {
    expect(groupNames([hub('a', 'B'), hub('b', 'A'), hub('c', 'B'), hub('d')])).toEqual(['B', 'A'])
  })
})

describe('canonicalGroup', () => {
  it('snaps to an existing group that differs only by case', () => {
    expect(canonicalGroup(' prospects ', ['Customers', 'Prospects'])).toBe('Prospects')
  })

  it('keeps a new group as typed, trimmed', () => {
    expect(canonicalGroup(' Partners ', ['Customers'])).toBe('Partners')
  })
})

describe('reorderWithin', () => {
  const names = ['a', 'b', 'c', 'd', 'e']

  it('moves a hub within a section without touching other slots', () => {
    // section b, d, e occupies slots 1, 3, 4
    expect(reorderWithin(names, ['b', 'd', 'e'], 'e', 'b')).toEqual(['a', 'e', 'c', 'b', 'd'])
  })

  it('moves later', () => {
    expect(reorderWithin(names, ['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd', 'e'])
  })

  it('returns the input for a no-op or unknown names', () => {
    expect(reorderWithin(names, ['a', 'b'], 'a', 'a')).toBe(names)
    expect(reorderWithin(names, ['a', 'b'], 'a', 'z')).toBe(names)
  })
})
