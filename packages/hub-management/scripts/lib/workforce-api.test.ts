import { describe, expect, it } from 'vitest'

import {
  cmsHubId,
  PAT_ENV_VARS,
  personalAccessToken,
  requiredEnv,
  versionFrom,
} from './workforce-api.mjs'

describe('cmsHubId', () => {
  // Derived, not allocated — which is why no environment needs a second id
  // configured alongside the Dynamic Content one.
  it('builds the opaque id Workforce addresses a hub by', () => {
    const id = cmsHubId('org_cv6BwQhSuDQJBONk', '6a7c803601ac4b1a73b30ebe')
    expect(Buffer.from(id, 'base64').toString('utf8')).toBe(
      'CMSHub:org_cv6BwQhSuDQJBONk/6a7c803601ac4b1a73b30ebe',
    )
  })
})

describe('requiredEnv', () => {
  it('returns a trimmed value', () => {
    expect(requiredEnv('AMPLIENCE_HUB_ID', 'x', { AMPLIENCE_HUB_ID: '  abc  ' })).toBe('abc')
  })

  it('names the variable and what it is for', () => {
    expect(() => requiredEnv('AMPLIENCE_HUB_ID', 'identify the hub', {})).toThrow(
      /AMPLIENCE_HUB_ID is not set.*identify the hub/s,
    )
  })

  it('treats whitespace as unset', () => {
    expect(() => requiredEnv('AMPLIENCE_HUB_ID', 'x', { AMPLIENCE_HUB_ID: '   ' })).toThrow()
  })
})

describe('personalAccessToken', () => {
  // The same order flows-cli resolves in, so anyone set up for one is set up
  // for the other.
  it('prefers AMPLIENCE_PAT, then falls back to FLOWS_CLI_TOKEN', () => {
    expect(PAT_ENV_VARS).toEqual(['AMPLIENCE_PAT', 'FLOWS_CLI_TOKEN'])
    expect(personalAccessToken({ AMPLIENCE_PAT: 'a', FLOWS_CLI_TOKEN: 'b' })).toBe('a')
    expect(personalAccessToken({ FLOWS_CLI_TOKEN: 'b' })).toBe('b')
  })

  it('says the hub credentials are not an option rather than just "missing"', () => {
    expect(() => personalAccessToken({})).toThrow(/does not accept the hub credentials/)
  })
})

describe('versionFrom', () => {
  it('prefers an explicit version field', () => {
    expect(versionFrom({ version: '2.2.0', label: 'Latest' })).toBe('2.2.0')
  })

  // quadraticlite's API has no `version` on a release, but the picker title
  // reads "(v2.2.0)" — so the label is where that number comes from.
  it('falls back to a label that is really a version', () => {
    expect(versionFrom({ label: '2.2.0' })).toBe('2.2.0')
    expect(versionFrom({ label: 'v2.2.0' })).toBe('2.2.0')
    expect(versionFrom({ label: '3' })).toBe('3')
  })

  // A handle built from "Latest" would match nothing on another hub and means
  // less than no version at all.
  it('ignores a label that is a name rather than a number', () => {
    expect(versionFrom({ label: 'Latest' })).toBeUndefined()
    expect(versionFrom({ label: 'release-2' })).toBeUndefined()
    expect(versionFrom({})).toBeUndefined()
    expect(versionFrom(undefined)).toBeUndefined()
  })
})
