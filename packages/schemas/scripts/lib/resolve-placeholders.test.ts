import { describe, expect, it } from 'vitest'

// The resolver is plain ESM (.mjs) shared with the hub-import script; import
// it directly so the test exercises the exact code the seed runs.
import {
  buildStatusMap,
  EXTENSION_INSTANCE_FIELDS,
  resolveTokens,
  stripFields,
} from './resolve-placeholders.mjs'

const settingsJson = {
  workflowStates: [
    { id: 'src-new', label: 'New', color: 'rgb(1,1,1)' },
    { id: 'src-review', label: 'Ready for Review', color: 'rgb(2,2,2)' },
  ],
}

// dc-cli's content-mapping save format: workflowStates is [[fromId, toId], …].
const settingsMap = {
  workflowStates: [
    ['src-new', 'tgt-new'],
    ['src-review', 'tgt-review'],
  ],
}

describe('buildStatusMap', () => {
  it('joins label → source id → target id', () => {
    const map = buildStatusMap(settingsJson, settingsMap)
    expect(map.get('New')).toBe('tgt-new')
    expect(map.get('Ready for Review')).toBe('tgt-review')
  })

  it('omits labels the mapping file has not resolved yet', () => {
    const partialMap = { workflowStates: [['src-new', 'tgt-new']] }
    const map = buildStatusMap(settingsJson, partialMap)
    expect(map.get('New')).toBe('tgt-new')
    expect(map.has('Ready for Review')).toBe(false)
  })

  it('throws on duplicate labels', () => {
    const dupe = {
      workflowStates: [
        { id: 'a', label: 'New' },
        { id: 'b', label: 'New' },
      ],
    }
    expect(() => buildStatusMap(dupe, settingsMap)).toThrow(/Duplicate workflow-state label "New"/)
  })

  it('tolerates empty / missing inputs', () => {
    expect(buildStatusMap({}, {}).size).toBe(0)
    expect(buildStatusMap(undefined, undefined).size).toBe(0)
  })
})

describe('resolveTokens', () => {
  const statusMap = buildStatusMap(settingsJson, settingsMap)

  it('substitutes hub, repo and status tokens', () => {
    const text = '{"hub":"${hub}","repo":"${repo:content}","s":"${status:New}"}'
    const out = resolveTokens(text, { hub: 'demo', repoContent: 'repo-123', statusMap })
    expect(out).toBe('{"hub":"demo","repo":"repo-123","s":"tgt-new"}')
  })

  it('handles whitespace inside a status token', () => {
    const out = resolveTokens('${status: Ready for Review }', { statusMap })
    expect(out).toBe('tgt-review')
  })

  it('fails loud on an unknown status label, naming the source', () => {
    expect(() =>
      resolveTokens('${status:Sent for Translation}', { statusMap, source: 'translation-board' }),
    ).toThrow(/translation-board: no workflow state labelled "Sent for Translation"/)
  })

  it('fails loud when a referenced env value is absent', () => {
    expect(() => resolveTokens('${repo:content}', { statusMap })).toThrow(
      /AMPLIENCE_REPO_CONTENT is not set/,
    )
    expect(() => resolveTokens('${hub}', { statusMap })).toThrow(/AMPLIENCE_HUB_NAME is not set/)
  })

  it('fails loud on any leftover placeholder', () => {
    expect(() => resolveTokens('${unknown:x}', { statusMap, source: 'ext' })).toThrow(
      /ext: unresolved placeholder \$\{unknown:x\}/,
    )
  })

  it('is a no-op when there are no tokens', () => {
    expect(resolveTokens('{"plain":true}', { statusMap })).toBe('{"plain":true}')
  })
})

describe('stripFields', () => {
  it('removes instance fields without mutating the input', () => {
    const input = { name: 'x', hubId: 'h', status: 'ACTIVE', url: 'u' }
    const out = stripFields(input, EXTENSION_INSTANCE_FIELDS)
    expect(out).toEqual({ name: 'x', url: 'u' })
    expect(input.hubId).toBe('h') // original untouched
  })
})
