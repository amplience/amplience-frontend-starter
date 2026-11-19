import { describe, expect, it } from 'vitest'

import { applyOrder, renameGroup } from './environment-order.ts'

const envs = ['a', 'b', 'c'].map((name) => ({ name }))
const names = (list: { name: string }[]) => list.map((e) => e.name)

describe('applyOrder', () => {
  it('reorders to the requested sequence', () => {
    expect(names(applyOrder(envs, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b'])
  })

  it('ignores unknown and repeated names', () => {
    expect(names(applyOrder(envs, ['b', 'zzz', 'b', 'a', 'c']))).toEqual(['b', 'a', 'c'])
  })

  it('keeps hubs missing from the request, at the end', () => {
    expect(names(applyOrder(envs, ['c']))).toEqual(['c', 'a', 'b'])
  })
})

describe('renameGroup', () => {
  const hubs = [{ group: 'Prospects' }, {}, { group: 'Customers' }, { group: 'Prospects' }]
  const groups = (list: { group?: string }[]) => list.map((h) => h.group)

  it('renames every hub in the group and leaves the rest alone', () => {
    expect(groups(renameGroup(hubs, 'Prospects', 'Leads'))).toEqual([
      'Leads',
      undefined,
      'Customers',
      'Leads',
    ])
  })

  it('merges into an existing group under its spelling', () => {
    expect(groups(renameGroup(hubs, 'Prospects', 'customers'))).toEqual([
      'Customers',
      undefined,
      'Customers',
      'Customers',
    ])
  })

  it('allows a change of case only', () => {
    expect(groups(renameGroup(hubs, 'Prospects', 'PROSPECTS'))[0]).toBe('PROSPECTS')
  })
})
