import { describe, expect, it } from 'vitest'

import {
  findEntry,
  installInput,
  instanceLabel,
  missingExtensions,
  parseEntry,
  releaseFor,
  resolveEnv,
  versionOfHandle,
} from './extensions.mjs'

const DC = {
  label: 'Amplience Dynamic Content',
  extensionId: 'RXh0ZW5zaW9uOmFhZTdkOGVi',
  description: 'Automate content management in Dynamic Content.',
  releases: { '2.2.0': 'cmVsZWFzZS0yLjIuMA==', '2.3.0': 'cmVsZWFzZS0yLjMuMA==' },
  env: {
    DC_PAT_TOKEN: '${secret:AMPLIENCE_PAT}',
    DC_HUB_ID: '${hub:id}',
    DC_HUB_NAME: '${hub:name}',
  },
}

const CONTENT_HUB = {
  label: 'Content Hub Integration',
  extensionId: 'RXh0ZW5zaW9uOmMxNjQ3ZGFm',
  env: {
    CLIENT_ID: '${secret:AMPLIENCE_CLIENT_ID}',
    CLIENT_SECRET: '${secret:AMPLIENCE_CLIENT_SECRET}',
  },
}

const context = {
  env: { AMPLIENCE_PAT: ' pat-value ', AMPLIENCE_CLIENT_ID: 'cid', AMPLIENCE_CLIENT_SECRET: 'sec' },
  hubId: '6a03b8012ab087641af296b6',
  hubName: 'quadraticlite',
}

describe('parseEntry', () => {
  it('reads a well-formed entry', () => {
    expect(parseEntry(DC).extensionId).toBe(DC.extensionId)
  })

  // The id is the same on every hub; the label is whatever someone typed.
  it('refuses an entry with no extensionId', () => {
    expect(() => parseEntry({ label: 'x', env: {} }, 'a.json')).toThrow(/no "extensionId"/)
  })

  it('refuses an entry with no label', () => {
    expect(() => parseEntry({ extensionId: 'x' }, 'a.json')).toThrow(/needs a "label"/)
  })

  it('allows an entry that pins no releases, as Content Hub does', () => {
    expect(parseEntry(CONTENT_HUB).releases).toBeUndefined()
  })
})

describe('releaseFor', () => {
  it('finds the release for a version', () => {
    expect(releaseFor(DC, '2.2.0')).toBe('cmVsZWFzZS0yLjIuMA==')
  })

  it('is undefined when no version is asked for, letting the hub pick', () => {
    expect(releaseFor(DC, undefined)).toBeUndefined()
  })

  it('names the versions it does have when asked for one it does not', () => {
    expect(() => releaseFor(DC, '9.9.9')).toThrow(/only 2\.2\.0, 2\.3\.0/)
  })

  it('says so plainly when the entry pins nothing', () => {
    expect(() => releaseFor(CONTENT_HUB, '1.0.0')).toThrow(/pins no versions at all/)
  })
})

describe('resolveEnv', () => {
  it('resolves secrets, trimming them', () => {
    expect(resolveEnv(DC.env, context)).toEqual({
      DC_PAT_TOKEN: 'pat-value',
      DC_HUB_ID: '6a03b8012ab087641af296b6',
      DC_HUB_NAME: 'quadraticlite',
    })
  })

  // Installing an extension that cannot authenticate moves the failure into a
  // flow at run time, which is the worst place to find it.
  it('refuses rather than installing with a missing secret', () => {
    expect(() => resolveEnv(DC.env, { ...context, env: {} })).toThrow(
      /needs AMPLIENCE_PAT, which is not set/,
    )
    expect(() => resolveEnv(DC.env, { ...context, env: { AMPLIENCE_PAT: '  ' } })).toThrow()
  })

  it('refuses a token it does not understand', () => {
    expect(() => resolveEnv({ A: '${repo:content}' }, context)).toThrow(/no rule matches/)
  })

  it('passes a literal through', () => {
    expect(resolveEnv({ REGION: 'eu-west-1', PORT: 443 }, context)).toEqual({
      REGION: 'eu-west-1',
      PORT: 443,
    })
  })
})

describe('installInput', () => {
  // The wiki installs the same instance under three different labels. Computing
  // it means the picker title parses back to the handle a fixture references.
  it('suffixes the label with the version so the handle round-trips', () => {
    expect(instanceLabel(DC, '2.2.0')).toBe('Amplience Dynamic Content (v2.2.0)')
    expect(instanceLabel(CONTENT_HUB, undefined)).toBe('Content Hub Integration')
  })

  it('builds the mutation input', () => {
    const env = resolveEnv(DC.env, context)
    expect(installInput(DC, { version: '2.2.0', hubRef: 'Q01TSHVi', env })).toEqual({
      cmsHubId: 'Q01TSHVi',
      extensionId: DC.extensionId,
      label: 'Amplience Dynamic Content (v2.2.0)',
      description: DC.description,
      extensionReleaseId: 'cmVsZWFzZS0yLjIuMA==',
      env,
    })
  })

  it('omits the release and description when the entry has neither', () => {
    const input = installInput(CONTENT_HUB, { hubRef: 'Q01TSHVi', env: {} })
    expect(input).not.toHaveProperty('extensionReleaseId')
    expect(input).not.toHaveProperty('description')
  })
})

describe('missingExtensions', () => {
  const fixture = {
    label: 'Localize',
    extensionInstances: {
      'Amplience Dynamic Content@2.2.0': { extension: DC.extensionId, sourceInstanceId: 'x' },
    },
    flow: { actions: [], edges: [] },
  }

  it('finds an extension the hub has no instance of', () => {
    expect(missingExtensions([fixture], [])).toEqual([
      { extensionId: DC.extensionId, handle: 'Amplience Dynamic Content@2.2.0', version: '2.2.0' },
    ])
  })

  // Keyed on the extension id, not the handle — a hub may well have it
  // installed under a different label.
  it('says nothing when the hub already has an instance of it', () => {
    const onHub = [{ id: 'i1', extensionId: DC.extensionId, label: 'Whatever They Called It' }]
    expect(missingExtensions([fixture], onHub)).toEqual([])
  })

  it('reports each extension once however many fixtures want it', () => {
    expect(missingExtensions([fixture, { ...fixture, label: 'Translate' }], [])).toHaveLength(1)
  })

  it('ignores a manifest entry with no extension recorded', () => {
    const bare = { ...fixture, extensionInstances: { 'X@1': { sourceInstanceId: 'y' } } }
    expect(missingExtensions([bare], [])).toEqual([])
  })
})

describe('versionOfHandle', () => {
  it('splits on the last @, so a label containing one survives', () => {
    expect(versionOfHandle('Amplience Dynamic Content@2.2.0')).toBe('2.2.0')
    expect(versionOfHandle('a@b@1.0')).toBe('1.0')
  })

  it('is undefined for a handle with no version', () => {
    expect(versionOfHandle('Content Hub Integration')).toBeUndefined()
    expect(versionOfHandle('Trailing@')).toBeUndefined()
  })
})

describe('findEntry', () => {
  it('matches on the extension id', () => {
    expect(findEntry([DC, CONTENT_HUB], CONTENT_HUB.extensionId)?.label).toBe(CONTENT_HUB.label)
    expect(findEntry([DC], 'nope')).toBeUndefined()
  })
})
