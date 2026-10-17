import { describe, expect, it } from 'vitest'

import {
  catalogueIndex,
  findEntry,
  installInput,
  instanceLabel,
  mergeCatalogue,
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

// DC and CONTENT_HUB above are raw file contents, which is what parseEntry
// takes. Everything downstream takes a parsed entry, so parse once here rather
// than hand-writing `installable` into the literals — that would quietly stop
// the default-value test from testing the default.
const dc = parseEntry(DC)
const contentHub = parseEntry(CONTENT_HUB)

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

  it('treats an entry with no flag as installable', () => {
    expect(parseEntry(DC).installable).toBe(true)
  })

  it('records an id without an install recipe when asked', () => {
    const entry = parseEntry({
      label: 'Salesforce B2C',
      extensionId: 'RXh0ZW5zaW9uOnNm',
      installable: false,
    })
    expect(entry.installable).toBe(false)
  })

  // Configuration nothing will ever read is worse than none: it reads as a
  // working recipe to whoever opens the file next.
  it('refuses an uninstallable entry that still carries an install recipe', () => {
    expect(() => parseEntry({ ...DC, installable: false }, 'dc.json')).toThrow(
      /installable.*false.*"releases"/s,
    )
    expect(() =>
      parseEntry({ label: 'x', extensionId: 'y', installable: false, env: { A: 'b' } }, 'x.json'),
    ).toThrow(/installable.*false.*"env"/s)
  })

  it('refuses a non-boolean flag rather than coercing it', () => {
    expect(() => parseEntry({ label: 'x', extensionId: 'y', installable: 'no' }, 'x.json')).toThrow(
      /non-boolean "installable"/,
    )
  })
})

describe('mergeCatalogue', () => {
  const sourced = (source: string, value: Record<string, unknown>) => ({
    source,
    value: parseEntry(value, source),
  })

  it('combines the checked-in and local sets', () => {
    const merged = mergeCatalogue(
      [sourced('workforce-extensions/dc.json', DC)],
      [sourced('local/theirs.json', { label: 'Their Thing', extensionId: 'RXh0ZW5zaW9uOnRo' })],
    )
    expect(merged.map((e) => e.label)).toEqual(['Amplience Dynamic Content', 'Their Thing'])
  })

  // Two entries for one extension contradict each other, and the loser would
  // simply never be read — a silence worth refusing.
  it('refuses the same extensionId in both homes, naming both files', () => {
    expect(() =>
      mergeCatalogue(
        [sourced('workforce-extensions/dc.json', DC)],
        [sourced('local/dc-copy.json', { ...DC, label: 'DC (ours)' })],
      ),
    ).toThrow(/catalogued twice.*dc\.json.*local\/dc-copy\.json/s)
  })

  // Different ids, same label: `extensions:push "<label>"` has no answer.
  it('refuses one label over two extension ids', () => {
    expect(() =>
      mergeCatalogue(
        [sourced('workforce-extensions/dc.json', DC)],
        [sourced('local/other.json', { ...DC, extensionId: 'RXh0ZW5zaW9uOm90aGVy' })],
      ),
    ).toThrow(/is catalogued twice.*different extension ids/s)
  })

  it('is fine with an empty local directory', () => {
    expect(mergeCatalogue([sourced('a.json', DC)], [])).toHaveLength(1)
    expect(mergeCatalogue()).toEqual([])
  })
})

describe('catalogueIndex', () => {
  it('keys the facts resolution needs by extension id', () => {
    const index = catalogueIndex([dc, contentHub])
    expect(index.get(DC.extensionId)).toEqual({
      label: 'Amplience Dynamic Content',
      installable: true,
    })
    expect(index.size).toBe(2)
  })

  it('carries the flag through, which is what changes the refusal wording', () => {
    const entry = parseEntry({ label: 'B2C', extensionId: 'RXh0ZW5zaW9uOmI=', installable: false })
    expect(catalogueIndex([entry]).get('RXh0ZW5zaW9uOmI=')?.installable).toBe(false)
  })
})

describe('releaseFor', () => {
  it('finds the release for a version', () => {
    expect(releaseFor(dc, '2.2.0')).toBe('cmVsZWFzZS0yLjIuMA==')
  })

  it('is undefined when no version is asked for, letting the hub pick', () => {
    expect(releaseFor(dc, undefined)).toBeUndefined()
  })

  it('names the versions it does have when asked for one it does not', () => {
    expect(() => releaseFor(dc, '9.9.9')).toThrow(/only 2\.2\.0, 2\.3\.0/)
  })

  it('says so plainly when the entry pins nothing', () => {
    expect(() => releaseFor(contentHub, '1.0.0')).toThrow(/pins no versions at all/)
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
    expect(instanceLabel(dc, '2.2.0')).toBe('Amplience Dynamic Content (v2.2.0)')
    expect(instanceLabel(contentHub, undefined)).toBe('Content Hub Integration')
  })

  it('builds the mutation input', () => {
    const env = resolveEnv(DC.env, context)
    expect(installInput(dc, { version: '2.2.0', hubRef: 'Q01TSHVi', env })).toEqual({
      cmsHubId: 'Q01TSHVi',
      extensionId: DC.extensionId,
      label: 'Amplience Dynamic Content (v2.2.0)',
      description: DC.description,
      extensionReleaseId: 'cmVsZWFzZS0yLjIuMA==',
      env,
    })
  })

  it('omits the release and description when the entry has neither', () => {
    const input = installInput(contentHub, { hubRef: 'Q01TSHVi', env: {} })
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
    expect(findEntry([dc, contentHub], CONTENT_HUB.extensionId)?.label).toBe(CONTENT_HUB.label)
    expect(findEntry([dc], 'nope')).toBeUndefined()
  })
})
