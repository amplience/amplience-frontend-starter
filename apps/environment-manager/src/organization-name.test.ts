import { describe, expect, it } from 'vitest'

import { coverageSentence, listPhrase } from './organization-name.js'

describe('listPhrase', () => {
  it('joins one, two and three items', () => {
    expect(listPhrase([])).toBe('')
    expect(listPhrase(['A'])).toBe('A')
    expect(listPhrase(['A', 'B'])).toBe('A and B')
    expect(listPhrase(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('coverageSentence', () => {
  it('names the organization when its label is known', () => {
    expect(coverageSentence({ label: 'Amplience Store Demo', hubs: ['Quadratic Lite'] })).toBe(
      'Setting it up for Amplience Store Demo covers this hub: Quadratic Lite.',
    )
  })

  it('counts and lists the hubs a token covers', () => {
    expect(coverageSentence({ hubs: ['Quadratic Lite', 'Matt Demo', 'Mango'] })).toBe(
      'Setting it up covers these 3 hubs: Quadratic Lite, Matt Demo and Mango.',
    )
  })

  // The common case on a first run: the hub is in the form but not saved yet,
  // so it isn't among the known hubs and the organization has no label either.
  it('falls back to the hub being set up when nothing else is known', () => {
    expect(coverageSentence({ hubs: [], currentHubLabel: 'Quadratic Lite' })).toBe(
      'Setting it up covers Quadratic Lite and every other hub you add to the same organization.',
    )
  })

  it('still says something useful with no label and no hubs at all', () => {
    expect(coverageSentence({ hubs: [] })).toBe(
      'Setting it up covers every hub in this organization.',
    )
  })

  it('treats a blank label as no label', () => {
    expect(coverageSentence({ label: '', hubs: ['Quadratic Lite'] })).toMatch(
      /^Setting it up covers/,
    )
  })
})
