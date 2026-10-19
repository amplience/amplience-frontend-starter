import { describe, expect, it } from 'vitest'

import { LOCAL_DIR, mergeFixtures, pullTarget } from './fixtures.mjs'

const entry = (label: string, source: string) => ({ label, source, value: { label } })

describe('pullTarget', () => {
  // Opting *in* to committing is the safe direction for a mistake: a flow
  // pulled from a customer hub can carry their brand names and credentials.
  it('writes to the gitignored subdirectory by default', () => {
    expect(pullTarget('/repo/flows')).toBe(`/repo/flows/${LOCAL_DIR}`)
    expect(pullTarget('/repo/flows', {})).toBe(`/repo/flows/${LOCAL_DIR}`)
  })

  it('writes to the checked-in directory only when asked', () => {
    expect(pullTarget('/repo/flows', { shared: true })).toBe('/repo/flows')
  })
})

describe('mergeFixtures', () => {
  it('returns both sets when nothing collides', () => {
    const merged = mergeFixtures(
      [entry('Localize', 'flows/localize.json')],
      [entry('Translate', 'flows/local/translate.json')],
    )
    expect(merged.map((e) => e.label)).toEqual(['Localize', 'Translate'])
  })

  it('copes with either side being empty or absent', () => {
    expect(mergeFixtures([], [entry('A', 'x')]).map((e) => e.label)).toEqual(['A'])
    expect(mergeFixtures([entry('A', 'x')]).map((e) => e.label)).toEqual(['A'])
    expect(mergeFixtures()).toEqual([])
  })

  // Precedence would mean "which copy won" is a question someone has to ask
  // mid-demo. Refusing is the only answer that cannot be wrong.
  it('refuses a label that is in both homes, naming both files', () => {
    expect(() =>
      mergeFixtures(
        [entry('Localize', 'flows/localize.json')],
        [entry('Localize', 'flows/local/localize.json')],
      ),
    ).toThrow(/"Localize" is defined twice.*flows\/localize\.json.*flows\/local\/localize\.json/s)
  })

  it('reports every clash, not just the first', () => {
    const run = () =>
      mergeFixtures(
        [entry('A', 'a.json'), entry('B', 'b.json')],
        [entry('A', 'local/a.json'), entry('B', 'local/b.json')],
      )
    expect(run).toThrow(/"A" is defined twice/)
    expect(run).toThrow(/"B" is defined twice/)
  })
})
