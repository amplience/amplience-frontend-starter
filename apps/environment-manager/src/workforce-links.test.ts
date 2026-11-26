import { describe, expect, it } from 'vitest'

import { contentItemUrl, personalAccessTokensUrl, schemaShortName } from './workforce-links.js'

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

describe('contentItemUrl', () => {
  it('links to the item in the DC editor, routed by hub name', () => {
    expect(contentItemUrl('my-hub', 'abc-123')).toBe(
      'https://app.amplience.net/content/#!/my-hub/authoring/content-item/edit/abc-123',
    )
  })

  it('offers no link without a hub name', () => {
    expect(contentItemUrl('', 'abc-123')).toBeUndefined()
  })
})

describe('schemaShortName', () => {
  it('takes the last path segment, without .json', () => {
    expect(schemaShortName('https://amplience.com/quadratic/hero-banner.json')).toBe('hero-banner')
  })

  it('is undefined for a missing schema', () => {
    expect(schemaShortName(undefined)).toBeUndefined()
  })
})
