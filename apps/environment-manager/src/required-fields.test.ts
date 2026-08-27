import { describe, expect, it } from 'vitest'

import { isRequired, missingRequired, REQUIRED_FIELDS } from './required-fields.js'
import { EMPTY_ENV } from './types.js'

const FILLED = {
  ...EMPTY_ENV,
  label: 'Client A',
  clientId: 'id',
  clientSecret: 'secret',
  hubName: 'clienta',
  hubId: 'hub-1',
  repoContent: 'repo-c',
  repoSlots: 'repo-s',
  localhostUrl: 'http://localhost:3000',
}

describe('isRequired', () => {
  it('marks the credential fields required', () => {
    expect(isRequired('clientId')).toBe(true)
    expect(isRequired('clientSecret')).toBe(true)
  })

  it('leaves optional fields unmarked', () => {
    expect(isRequired('stagingHost')).toBe(false)
    expect(isRequired('repoSiteComponents')).toBe(false)
  })

  it('does not require the derived identifier', () => {
    expect(isRequired('name')).toBe(false)
  })
})

describe('missingRequired', () => {
  it('returns nothing for a fully filled environment', () => {
    expect(missingRequired(FILLED)).toEqual([])
  })

  it('lists every blank required field in form order', () => {
    expect(missingRequired(EMPTY_ENV)).toEqual(
      REQUIRED_FIELDS.filter((key) => key !== 'localhostUrl'),
    )
  })

  it('treats whitespace as blank', () => {
    expect(missingRequired({ ...FILLED, clientSecret: '   ' })).toEqual(['clientSecret'])
  })

  it('flags a missing identifier-free label', () => {
    expect(missingRequired({ ...FILLED, label: '' })).toEqual(['label'])
  })
})
