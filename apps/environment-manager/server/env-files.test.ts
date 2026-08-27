import { describe, expect, it } from 'vitest'

import { hubManagementEnvVars, updateEnvVars, webEnvVars, type EnvSource } from './env-files.ts'

const HUB: EnvSource = {
  hubName: 'acme-hub',
  hubId: 'hub-123',
  localhostUrl: 'http://localhost:3000',
  repoContent: 'repo-content',
  repoSlots: 'repo-slots',
  repoSiteComponents: 'repo-site-components',
  revalidateSecret: 's3cret',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  stagingHost: 'acme.staging.bigcontent.io',
  defaultBrand: 'acme',
  defaultSite: 'acme-store',
}

describe('updateEnvVars', () => {
  it('replaces an existing key in place, preserving surrounding lines', () => {
    const before = '# Local overrides\nNEXT_PUBLIC_BRAND="old"\nOTHER="keep"\n'
    expect(updateEnvVars(before, { NEXT_PUBLIC_BRAND: 'acme' })).toBe(
      '# Local overrides\nNEXT_PUBLIC_BRAND="acme"\nOTHER="keep"\n',
    )
  })

  it('revives a commented-out key rather than appending a duplicate', () => {
    expect(updateEnvVars('# NEXT_PUBLIC_BRAND=\n', { NEXT_PUBLIC_BRAND: 'acme' })).toBe(
      'NEXT_PUBLIC_BRAND="acme"\n',
    )
  })

  it('blanks an active key when the value is undefined, so no value lingers', () => {
    expect(updateEnvVars('NEXT_PUBLIC_BRAND="acme"\n', { NEXT_PUBLIC_BRAND: undefined })).toBe(
      '# NEXT_PUBLIC_BRAND=\n',
    )
  })

  // .env carries documented example values on commented lines; clearing a key
  // must not eat them (it did, until it started writing .env instead of .env.local).
  it('leaves an already-commented key untouched when the value is undefined', () => {
    const docs = '# AMPLIENCE_HUB_NAME="quadraticlite"\n'
    expect(updateEnvVars(docs, { AMPLIENCE_HUB_NAME: undefined })).toBe(docs)
  })

  // A trailing newline splits into an empty final line, so an appended key
  // lands after a blank one — cosmetic, and what existing .env files look like.
  it('appends keys that are not in the file yet', () => {
    expect(updateEnvVars('OTHER="keep"\n', { NEXT_PUBLIC_BRAND: 'acme' })).toBe(
      'OTHER="keep"\n\nNEXT_PUBLIC_BRAND="acme"\n',
    )
  })

  it('skips absent keys that have no value, so the file stays uncluttered', () => {
    expect(updateEnvVars('OTHER="keep"\n', { NEXT_PUBLIC_BRAND: undefined })).toBe('OTHER="keep"\n')
  })

  it('matches a key written with spaces around the equals sign', () => {
    expect(updateEnvVars('NEXT_PUBLIC_BRAND = old\n', { NEXT_PUBLIC_BRAND: 'acme' })).toBe(
      'NEXT_PUBLIC_BRAND="acme"\n',
    )
  })

  it('returns an empty string for an empty file with nothing to write', () => {
    expect(updateEnvVars('', { NEXT_PUBLIC_BRAND: undefined })).toBe('')
  })
})

describe('webEnvVars', () => {
  it('maps an active hub onto the vars the web app reads', () => {
    expect(webEnvVars(HUB, 'ignored')).toEqual({
      AMPLIENCE_HUB_NAME: 'acme-hub',
      AMPLIENCE_STAGING_HOST: 'acme.staging.bigcontent.io',
      NEXT_PUBLIC_BRAND: 'acme',
      SITE_NAME: 'acme-store',
      AMPLIENCE_REVALIDATE_SECRET: 's3cret',
    })
  })

  it('takes the hub brand, not the fixtures brand, while a hub is active', () => {
    expect(webEnvVars(HUB, 'other-brand').NEXT_PUBLIC_BRAND).toBe('acme')
  })

  it('applies the fixtures brand and clears every connection var for fixtures', () => {
    expect(webEnvVars(null, 'acme')).toEqual({
      AMPLIENCE_HUB_NAME: undefined,
      AMPLIENCE_STAGING_HOST: undefined,
      NEXT_PUBLIC_BRAND: 'acme',
      SITE_NAME: undefined,
      AMPLIENCE_REVALIDATE_SECRET: undefined,
    })
  })

  it('leaves the brand unset when the fixtures brand is blank', () => {
    expect(webEnvVars(null, '   ').NEXT_PUBLIC_BRAND).toBeUndefined()
  })

  it('trims the fixtures brand', () => {
    expect(webEnvVars(null, '  acme  ').NEXT_PUBLIC_BRAND).toBe('acme')
  })

  it('leaves a blank site name unset so the runtime hub-name default applies', () => {
    expect(webEnvVars({ ...HUB, defaultSite: '' }, '').SITE_NAME).toBeUndefined()
  })
})

describe('hubManagementEnvVars', () => {
  it('maps an active hub onto the vars the hub:* scripts consume', () => {
    expect(hubManagementEnvVars(HUB)).toEqual({
      AMPLIENCE_HUB_NAME: 'acme-hub',
      AMPLIENCE_HUB_ID: 'hub-123',
      LOCALHOST_URL: 'http://localhost:3000',
      AMPLIENCE_REPO_CONTENT: 'repo-content',
      AMPLIENCE_REPO_SLOTS: 'repo-slots',
      AMPLIENCE_REPO_SITE_COMPONENTS: 'repo-site-components',
      AMPLIENCE_CLIENT_ID: 'client-id',
      AMPLIENCE_CLIENT_SECRET: 'client-secret',
      AMPLIENCE_STAGING_HOST: 'acme.staging.bigcontent.io',
      SITE_NAME: 'acme-store',
      AMPLIENCE_REVALIDATE_SECRET: 's3cret',
    })
  })

  it('clears everything for fixtures — there is no hub to target', () => {
    expect(Object.values(hubManagementEnvVars(null)).every((v) => v === undefined)).toBe(true)
  })

  it('never gets a brand — brand is a web-app concern only', () => {
    expect(hubManagementEnvVars(HUB)).not.toHaveProperty('NEXT_PUBLIC_BRAND')
  })

  it('drops blank optional fields rather than writing empty values', () => {
    const sparse = { ...HUB, repoSiteComponents: '', revalidateSecret: '  ' }
    expect(hubManagementEnvVars(sparse).AMPLIENCE_REPO_SITE_COMPONENTS).toBeUndefined()
    expect(hubManagementEnvVars(sparse).AMPLIENCE_REVALIDATE_SECRET).toBeUndefined()
  })
})
