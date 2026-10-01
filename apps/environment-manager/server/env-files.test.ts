import { describe, expect, it } from 'vitest'

import type { SiteIdentity } from './active-source.ts'
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
}

/** The hub's localhost row: a site named `acme-store`, serving starter content. */
const ON_HUB: SiteIdentity = {
  siteName: 'acme-store',
  fixtureSet: 'frontend-starter',
  brand: 'acme',
  title: undefined,
}

/** A fixture set active instead of a hub — it is its own site. */
const OFFLINE: SiteIdentity = {
  siteName: 'anyafinn',
  fixtureSet: 'anyafinn',
  brand: 'anyafinn',
  title: 'Anya Finn',
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
    expect(webEnvVars(HUB, ON_HUB)).toEqual({
      AMPLIENCE_HUB_NAME: 'acme-hub',
      AMPLIENCE_STAGING_HOST: 'acme.staging.bigcontent.io',
      CONTENT_CLIENT: undefined,
      NEXT_PUBLIC_BRAND: 'acme',
      SITE_NAME: 'acme-store',
      FIXTURE_SET: 'frontend-starter',
      AMPLIENCE_REVALIDATE_SECRET: 's3cret',
    })
  })

  it('clears every connection var and pins the mock when a set is active', () => {
    expect(webEnvVars(null, OFFLINE)).toEqual({
      AMPLIENCE_HUB_NAME: undefined,
      AMPLIENCE_STAGING_HOST: undefined,
      CONTENT_CLIENT: 'mock',
      NEXT_PUBLIC_BRAND: 'anyafinn',
      SITE_NAME: 'anyafinn',
      FIXTURE_SET: 'anyafinn',
      SITE_TITLE: 'Anya Finn',
      AMPLIENCE_REVALIDATE_SECRET: undefined,
    })
  })

  it('clears CONTENT_CLIENT on a hub, so the app cannot stay on the mock', () => {
    // Every other var would say Amplience while the pages still came from disk.
    expect(webEnvVars(HUB, ON_HUB).CONTENT_CLIENT).toBeUndefined()
  })

  it('titles pages only when something carries a title', () => {
    // A hub's title belongs to the deployment; blanking it would replace a
    // working value with nothing, so the key is written but never cleared.
    expect(webEnvVars(HUB, ON_HUB)).not.toHaveProperty('SITE_TITLE')
    expect(webEnvVars(null, { ...OFFLINE, title: '  ' })).not.toHaveProperty('SITE_TITLE')
  })

  it('leaves the brand unset when nothing supplies one', () => {
    expect(webEnvVars(null, { ...OFFLINE, brand: '   ' }).NEXT_PUBLIC_BRAND).toBeUndefined()
  })

  it('clears both site vars when there is no identity at all', () => {
    expect(webEnvVars(null, undefined)).toMatchObject({
      SITE_NAME: undefined,
      FIXTURE_SET: undefined,
    })
  })
})

describe('hubManagementEnvVars', () => {
  it('maps an active hub onto the vars the hub:* scripts consume', () => {
    expect(hubManagementEnvVars(HUB, ON_HUB)).toEqual({
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
      FIXTURE_SET: 'frontend-starter',
      AMPLIENCE_REVALIDATE_SECRET: 's3cret',
    })
  })

  it('clears everything for a set — there is no hub to target', () => {
    const vars = hubManagementEnvVars(null, undefined)
    expect(Object.values(vars).every((v) => v === undefined)).toBe(true)
  })

  it('never gets a brand or a title — both are web-app concerns', () => {
    expect(hubManagementEnvVars(HUB, ON_HUB)).not.toHaveProperty('NEXT_PUBLIC_BRAND')
    expect(hubManagementEnvVars(HUB, ON_HUB)).not.toHaveProperty('SITE_TITLE')
  })

  it('drops blank optional fields rather than writing empty values', () => {
    const sparse = { ...HUB, repoSiteComponents: '', revalidateSecret: '  ' }
    expect(hubManagementEnvVars(sparse, ON_HUB).AMPLIENCE_REPO_SITE_COMPONENTS).toBeUndefined()
    expect(hubManagementEnvVars(sparse, ON_HUB).AMPLIENCE_REVALIDATE_SECRET).toBeUndefined()
  })
})

describe('SITE_NAME and FIXTURE_SET travel together', () => {
  // The failure this pairing exists to prevent: a stale namespace in one file
  // re-targeting a seed, so the import writes one prefix while the app reads
  // another and every page 404s with nothing looking wrong.
  const both = (site: SiteIdentity | undefined) => [
    webEnvVars(null, site),
    hubManagementEnvVars(null, site),
  ]

  it('writes both files from one identity, so they cannot disagree', () => {
    for (const vars of both(OFFLINE)) {
      expect(vars.SITE_NAME).toBe('anyafinn')
      expect(vars.FIXTURE_SET).toBe('anyafinn')
    }
  })

  it('carries a namespace that differs from the set — the partner path', () => {
    const partner: SiteIdentity = { ...OFFLINE, siteName: 'acme', fixtureSet: 'frontend-starter' }
    for (const vars of both(partner)) {
      expect(vars.SITE_NAME).toBe('acme')
      expect(vars.FIXTURE_SET).toBe('frontend-starter')
    }
  })

  it('never sets one while clearing the other', () => {
    for (const vars of both(undefined)) {
      expect(vars.SITE_NAME).toBeUndefined()
      expect(vars.FIXTURE_SET).toBeUndefined()
    }
  })
})
