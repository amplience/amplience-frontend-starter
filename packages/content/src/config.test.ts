/**
 * resolveContentConfig tests (QL-43) — the env → client-selection seam.
 * The contract under test: no configuration always means the mock (the
 * fresh-clone offline experience); AMPLIENCE_HUB_NAME present implies sdk;
 * explicit CONTENT_CLIENT overrides inference; misconfiguration fails loud
 * at composition time rather than surfacing as a renderer failure card.
 */

import { describe, expect, it } from 'vitest'

import { resolveContentConfig } from './config'

describe('resolveContentConfig', () => {
  it('defaults to the mock with no configuration at all', () => {
    expect(resolveContentConfig({})).toEqual({ kind: 'mock' })
  })

  it('treats an empty CONTENT_CLIENT as unset', () => {
    expect(resolveContentConfig({ CONTENT_CLIENT: '' })).toEqual({ kind: 'mock' })
  })

  it('selects the mock explicitly', () => {
    expect(resolveContentConfig({ CONTENT_CLIENT: 'mock' })).toEqual({ kind: 'mock' })
  })

  it('infers sdk when AMPLIENCE_HUB_NAME is set (no CONTENT_CLIENT needed)', () => {
    expect(resolveContentConfig({ AMPLIENCE_HUB_NAME: 'quadraticlite' })).toEqual({
      kind: 'sdk',
      hubName: 'quadraticlite',
    })
  })

  it('explicit CONTENT_CLIENT=mock overrides hub-name inference', () => {
    expect(
      resolveContentConfig({ CONTENT_CLIENT: 'mock', AMPLIENCE_HUB_NAME: 'quadraticlite' }),
    ).toEqual({ kind: 'mock' })
  })

  it('selects the sdk with an explicit CONTENT_CLIENT=sdk and a hub name', () => {
    expect(
      resolveContentConfig({ CONTENT_CLIENT: 'sdk', AMPLIENCE_HUB_NAME: 'quadraticlite' }),
    ).toEqual({ kind: 'sdk', hubName: 'quadraticlite' })
  })

  it('carries staging host and locale only when present', () => {
    expect(
      resolveContentConfig({
        AMPLIENCE_HUB_NAME: 'quadraticlite',
        AMPLIENCE_STAGING_HOST: 'abc.staging.bigcontent.io',
        AMPLIENCE_LOCALE: 'en-GB',
      }),
    ).toEqual({
      kind: 'sdk',
      hubName: 'quadraticlite',
      stagingHost: 'abc.staging.bigcontent.io',
      locale: 'en-GB',
    })

    expect(
      resolveContentConfig({
        AMPLIENCE_HUB_NAME: 'quadraticlite',
        AMPLIENCE_STAGING_HOST: '',
      }),
    ).toEqual({ kind: 'sdk', hubName: 'quadraticlite' })
  })

  it('throws loudly when sdk is forced without a hub name', () => {
    expect(() => resolveContentConfig({ CONTENT_CLIENT: 'sdk' })).toThrow(/AMPLIENCE_HUB_NAME/)
    expect(() => resolveContentConfig({ CONTENT_CLIENT: 'sdk', AMPLIENCE_HUB_NAME: '' })).toThrow(
      /AMPLIENCE_HUB_NAME/,
    )
  })

  it('throws loudly on an unknown CONTENT_CLIENT value', () => {
    expect(() => resolveContentConfig({ CONTENT_CLIENT: 'sdkk' })).toThrow(
      /expected "mock" or "sdk"/,
    )
  })

  it('reads process.env by default', () => {
    expect(resolveContentConfig()).toEqual({ kind: 'mock' })
  })
})
