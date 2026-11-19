import { describe, expect, it } from 'vitest'

import { applyOrder } from './environment-order.ts'

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
