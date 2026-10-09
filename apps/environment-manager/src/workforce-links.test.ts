import { describe, expect, it } from 'vitest'

import { personalAccessTokensUrl } from './workforce-links.js'

describe('personalAccessTokensUrl', () => {
  it('builds the hub-scoped token screen', () => {
    expect(personalAccessTokensUrl('mattdemo')).toBe(
      'https://app.amplience.net/content/#!/mattdemo/development/personal-access-tokens',
    )
  })

  it('trims and encodes the hub name', () => {
    expect(personalAccessTokensUrl(' my hub ')).toBe(
      'https://app.amplience.net/content/#!/my%20hub/development/personal-access-tokens',
    )
  })

  // No link at all beats a link that goes nowhere.
  it('is undefined without a hub name', () => {
    expect(personalAccessTokensUrl(undefined)).toBeUndefined()
    expect(personalAccessTokensUrl('')).toBeUndefined()
    expect(personalAccessTokensUrl('   ')).toBeUndefined()
  })
})
