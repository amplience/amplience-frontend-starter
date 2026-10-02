/**
 * resolveContentConfig tests (QL-43, QL-131) — the env → client-selection
 * seam. The contract under test: no configuration always means the mock
 * serving the fixture site (the fresh-clone offline experience);
 * AMPLIENCE_HUB_NAME present implies sdk; explicit CONTENT_CLIENT overrides
 * inference; the site name (ADR-0014) defaults to the fixture set's name
 * (ADR-0019) — FIXTURE_SET, else the default set — with an explicit SITE_NAME
 * winning in sdk mode and ignored by the mock; misconfiguration fails loud at composition time rather than
 * surfacing as a renderer failure card.
 */

import { describe, expect, it } from 'vitest'

import { FIXTURE_SITE_NAME, resolveContentConfig } from './config'

const sdkEnv = { AMPLIENCE_HUB_NAME: 'quadraticlite' }

describe('resolveContentConfig', () => {
  it('defaults to the mock with no configuration at all', () => {
    expect(resolveContentConfig({})).toEqual({ kind: 'mock', siteName: FIXTURE_SITE_NAME })
  })

  it('treats an empty CONTENT_CLIENT as unset', () => {
    expect(resolveContentConfig({ CONTENT_CLIENT: '' })).toEqual({
      kind: 'mock',
      siteName: FIXTURE_SITE_NAME,
    })
  })

  it('selects the mock explicitly', () => {
    expect(resolveContentConfig({ CONTENT_CLIENT: 'mock' })).toEqual({
      kind: 'mock',
      siteName: FIXTURE_SITE_NAME,
    })
  })

  it('lets FIXTURE_SET choose the set the mock serves', () => {
    expect(resolveContentConfig({ FIXTURE_SET: 'anyafinn' })).toEqual({
      kind: 'mock',
      siteName: 'anyafinn',
    })
  })

  it('ignores SITE_NAME in the mock, which has no re-prefixing step', () => {
    expect(resolveContentConfig({ SITE_NAME: 'acme' })).toEqual({
      kind: 'mock',
      siteName: FIXTURE_SITE_NAME,
    })
    expect(resolveContentConfig({ SITE_NAME: 'acme', FIXTURE_SET: 'anyafinn' })).toEqual({
      kind: 'mock',
      siteName: 'anyafinn',
    })
  })

  it('infers sdk when AMPLIENCE_HUB_NAME is set (no CONTENT_CLIENT needed)', () => {
    expect(resolveContentConfig(sdkEnv)).toEqual({
      kind: 'sdk',
      hubName: 'quadraticlite',
      siteName: FIXTURE_SITE_NAME,
    })
  })

  it('defaults the sdk site name to the fixture set (hub-import seeds under the same default)', () => {
    expect(resolveContentConfig({ AMPLIENCE_HUB_NAME: 'acme' })).toMatchObject({
      siteName: FIXTURE_SITE_NAME,
    })
    expect(resolveContentConfig({ AMPLIENCE_HUB_NAME: 'acme', SITE_NAME: '' })).toMatchObject({
      siteName: FIXTURE_SITE_NAME,
    })
    expect(
      resolveContentConfig({ AMPLIENCE_HUB_NAME: 'acme', FIXTURE_SET: 'anyafinn' }),
    ).toMatchObject({ siteName: 'anyafinn' })
  })

  it('lets an explicit SITE_NAME override the fixture-set default', () => {
    expect(resolveContentConfig({ ...sdkEnv, SITE_NAME: 'acme-store' })).toEqual({
      kind: 'sdk',
      hubName: 'quadraticlite',
      siteName: 'acme-store',
    })
  })

  it('no longer derives the site name from the hub name, so any hub name is accepted', () => {
    expect(resolveContentConfig({ AMPLIENCE_HUB_NAME: 'Acme Hub' })).toMatchObject({
      siteName: FIXTURE_SITE_NAME,
    })
  })

  it('rejects a malformed FIXTURE_SET at composition time', () => {
    expect(() => resolveContentConfig({ FIXTURE_SET: 'Anya Finn' })).toThrow(/FIXTURE_SET/)
    expect(() => resolveContentConfig({ ...sdkEnv, FIXTURE_SET: 'Anya Finn' })).toThrow(
      /FIXTURE_SET/,
    )
  })

  it('explicit CONTENT_CLIENT=mock overrides hub-name inference', () => {
    // Site name follows the client kind: mock without SITE_NAME serves the
    // fixture site, whatever the (unused) hub is called.
    expect(resolveContentConfig({ CONTENT_CLIENT: 'mock', ...sdkEnv })).toEqual({
      kind: 'mock',
      siteName: FIXTURE_SITE_NAME,
    })
  })

  it('selects the sdk with an explicit CONTENT_CLIENT=sdk and a hub name', () => {
    expect(resolveContentConfig({ CONTENT_CLIENT: 'sdk', ...sdkEnv })).toEqual({
      kind: 'sdk',
      hubName: 'quadraticlite',
      siteName: FIXTURE_SITE_NAME,
    })
  })

  it('carries staging host and locale only when present', () => {
    expect(
      resolveContentConfig({
        ...sdkEnv,
        AMPLIENCE_STAGING_HOST: 'abc.staging.bigcontent.io',
        AMPLIENCE_LOCALE: 'en-GB',
      }),
    ).toEqual({
      kind: 'sdk',
      hubName: 'quadraticlite',
      siteName: FIXTURE_SITE_NAME,
      stagingHost: 'abc.staging.bigcontent.io',
      locale: 'en-GB',
    })

    expect(
      resolveContentConfig({
        ...sdkEnv,
        AMPLIENCE_STAGING_HOST: '',
      }),
    ).toEqual({ kind: 'sdk', hubName: 'quadraticlite', siteName: FIXTURE_SITE_NAME })
  })

  it('throws loudly when sdk is forced without a hub name', () => {
    expect(() => resolveContentConfig({ CONTENT_CLIENT: 'sdk' })).toThrow(/AMPLIENCE_HUB_NAME/)
    expect(() => resolveContentConfig({ CONTENT_CLIENT: 'sdk', AMPLIENCE_HUB_NAME: '' })).toThrow(
      /AMPLIENCE_HUB_NAME/,
    )
  })

  it.each(['Acme', 'acme store', 'acme/store', '-acme', 'acme-', 'a--b'])(
    'rejects the malformed explicit site name "%s" at composition time',
    (bad) => {
      expect(() => resolveContentConfig({ ...sdkEnv, SITE_NAME: bad })).toThrow(/site name/)
    },
  )

  it('reads process.env by default', () => {
    expect(resolveContentConfig()).toEqual({ kind: 'mock', siteName: FIXTURE_SITE_NAME })
  })
})
