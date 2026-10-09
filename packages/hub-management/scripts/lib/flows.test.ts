import { describe, expect, it } from 'vitest'

import {
  decodeOpaqueId,
  fixtureFileName,
  instanceHandle,
  instanceTitles,
  opaqueType,
  parseInstanceTitle,
  stripVirtualAction,
  toFixture,
  tokeniseGraph,
  untokenisedReferences,
} from './flows.mjs'

const opaque = (value: string) => Buffer.from(value, 'utf8').toString('base64')

const INSTANCE = opaque('ExtensionInstance:4224791c-c987-4108-abdd-484b97db73af')
const EXTENSION = opaque('Extension:aae7d8eb-d229-4566-86cc-3fa9c6fe23e6')
const LISTENER = opaque('WebhookListener:a3751a36-2a48-4d96-ac77-bdbf97e25e16')
const MODEL = opaque('ContentGenerationModel:05fb3a18-a8cf-41e7-b025-fb2c71a80cb4')
const STATE = '6a7c92d701ac4b1a73b31676'

const registry = {
  extensionInstances: [{ id: INSTANCE, extensionId: EXTENSION }],
  listeners: [{ id: LISTENER, label: 'Localize trigger' }],
  workflowStates: [{ id: STATE, label: 'Ready for Translation' }],
}

const INSTANCE_B = opaque('ExtensionInstance:40217613-212e-46ba-99c4-6d924a6d7644')

/** The instance picker, which is the only place an instance's name appears. */
const picker = (options: { const: string; title: string }[]) => ({
  name: 'ext-localize',
  baseAction: 'extension-action',
  config: { schema: { properties: { instanceId: { oneOf: options } } } },
  data: { actionName: 'localizeContentItem' },
})

const graph = {
  virtualActions: [
    picker([
      { const: INSTANCE, title: 'Amplience Dynamic Content (v2.2.0)' },
      { const: INSTANCE_B, title: 'Mango Fashion DC Integration (v2.1.0)' },
    ]),
  ],
  actions: [
    { id: 'a1', action: 'webhook-trigger', config: { 'amp:webhookId': LISTENER } },
    { id: 'a2', action: 'ext-localize', config: { instanceId: INSTANCE } },
    { id: 'a3', action: 'translation-agent', config: { model: MODEL } },
    { id: 'a4', action: 'loop', config: {} },
  ],
  edges: [
    {
      id: 'e1',
      from: { actionId: 'a1' },
      to: { actionId: 'a2' },
      inputs: { workflowStateId: STATE },
    },
    { id: 'e2', from: { actionId: 'a2' }, to: { actionId: 'a3' }, inputs: { locales: ['de-DE'] } },
  ],
}

describe('decodeOpaqueId / opaqueType', () => {
  it('decodes a Relay global id', () => {
    expect(decodeOpaqueId(INSTANCE)).toBe('ExtensionInstance:4224791c-c987-4108-abdd-484b97db73af')
    expect(opaqueType(LISTENER)).toBe('WebhookListener')
  })

  it('is undefined for anything that is not one', () => {
    expect(decodeOpaqueId('loop')).toBeUndefined()
    expect(decodeOpaqueId(42)).toBeUndefined()
    // A 24-character hex id matches the base64 character class but decodes to junk.
    expect(decodeOpaqueId(STATE)).toBeUndefined()
  })
})

describe('tokeniseGraph', () => {
  it('replaces the three per-hub references and nothing else', () => {
    const { flow, warnings } = tokeniseGraph(graph, registry)
    const configs = flow.actions.map((a) => a.config)
    expect(configs[0]).toEqual({ 'amp:webhookId': '${listener:Localize trigger}' })
    expect(configs[1]).toEqual({
      instanceId: '${extensionInstance:Amplience Dynamic Content@2.2.0}',
    })
    // Left alone: no rule covers a generation model, and guessing is how a flow
    // imports cleanly and dies at run time.
    expect(configs[2]).toEqual({ model: MODEL })
    expect(flow.edges[0]?.inputs?.workflowStateId).toBe('${status:Ready for Translation}')
    expect(warnings).toEqual([])
  })

  // A seventeen-action flow using one ambiguous extension is one thing to fix,
  // not six identical lines to scroll past.
  it('reports each problem once, however many actions hit it', () => {
    const twice = {
      ...graph,
      virtualActions: [picker([])],
      actions: [
        ...graph.actions,
        { id: 'a5', action: 'ext-localize', config: { instanceId: INSTANCE } },
      ],
    }
    const { warnings } = tokeniseGraph(twice, { ...registry, extensionInstances: [] })
    expect(warnings).toHaveLength(1)
  })

  it('leaves locales exactly as authored', () => {
    const { flow } = tokeniseGraph(graph, registry)
    expect(flow.edges[1]?.inputs).toEqual({ locales: ['de-DE'] })
  })

  it('never regenerates an action or edge id', () => {
    const { flow } = tokeniseGraph(graph, registry)
    expect(flow.actions.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4'])
    expect(flow.edges.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(flow.edges[0]?.from).toEqual({ actionId: 'a1' })
  })

  // Hubs routinely hold several instances of one extension, differing by version
  // or by what they point at — the single most common thing that breaks when a
  // flow is moved. The handle has to tell them apart.
  it('distinguishes two instances of the same extension by name and version', () => {
    const { flow, warnings } = tokeniseGraph(graph, {
      ...registry,
      extensionInstances: [
        { id: INSTANCE, extensionId: EXTENSION },
        { id: INSTANCE_B, extensionId: EXTENSION },
      ],
    })
    expect(flow.actions[1]?.config?.instanceId).toBe(
      '${extensionInstance:Amplience Dynamic Content@2.2.0}',
    )
    expect(warnings).toEqual([])
  })

  // Still tokenised — the title came from the flow itself — but the fixture
  // records no extension, so push has nothing to fall back to.
  it('says so when the hub registry does not know the instance', () => {
    const { flow, extensionInstances, warnings } = tokeniseGraph(graph, {
      ...registry,
      extensionInstances: [],
    })
    expect(flow.actions[1]?.config?.instanceId).toBe(
      '${extensionInstance:Amplience Dynamic Content@2.2.0}',
    )
    expect(extensionInstances['Amplience Dynamic Content@2.2.0']).toEqual({
      sourceInstanceId: INSTANCE,
    })
    expect(warnings[0]).toContain('no extension to fall back to')
  })

  it('records the extension behind each handle, for the fallback', () => {
    const { extensionInstances } = tokeniseGraph(graph, registry)
    expect(extensionInstances).toEqual({
      'Amplience Dynamic Content@2.2.0': { extension: EXTENSION, sourceInstanceId: INSTANCE },
    })
  })

  it('has nothing to match by when an instance has no title anywhere', () => {
    const untitled = { ...graph, virtualActions: [picker([])] }
    const { flow, warnings } = tokeniseGraph(untitled, { ...registry, extensionInstances: [] })
    expect(flow.actions[1]?.config?.instanceId).toBe(INSTANCE)
    expect(warnings[0]).toContain('no title on this hub')
  })

  // A token is resolved back by label, so an ambiguous label cannot round-trip.
  it('refuses to tokenise against a duplicated label', () => {
    const { flow, warnings } = tokeniseGraph(graph, {
      ...registry,
      workflowStates: [
        { id: STATE, label: 'Ready' },
        { id: 'other', label: 'Ready' },
      ],
    })
    expect(flow.edges[0]?.inputs?.workflowStateId).toBe(STATE)
    expect(warnings[0]).toContain('both labelled')
  })

  it('does not mutate the flow it was given', () => {
    tokeniseGraph(graph, registry)
    expect(graph.actions[1]?.config?.instanceId).toBe(INSTANCE)
  })
})

describe('untokenisedReferences', () => {
  it('reports what is left, so nobody has to notice it on a customer hub', () => {
    const { flow } = tokeniseGraph(graph, registry)
    expect(untokenisedReferences(flow)).toEqual([
      'ContentGenerationModel:05fb3a18-a8cf-41e7-b025-fb2c71a80cb4',
    ])
  })
})

describe('stripVirtualAction', () => {
  const virtualAction = {
    name: 'ext-localize',
    baseAction: 'extension-action',
    label: 'Localize Content Item',
    description: 'Localizes an item',
    category: 'Amplience Dynamic Content',
    group: 'INTEGRATIONS',
    icon: 'data:image/svg+xml;base64,PHN2Zy8+',
    config: {
      schema: {
        properties: {
          instanceId: { title: 'Instance', default: INSTANCE, oneOf: [{ const: INSTANCE }] },
        },
      },
    },
    data: {
      actionName: 'localizeContentItem',
      instances: [{ id: INSTANCE }],
      releases: [{ id: 'r' }],
    },
  }

  it('drops the icon and the source hub"s instances, releases and listeners', () => {
    const stripped = stripVirtualAction({
      ...virtualAction,
      data: { ...virtualAction.data, webhookListeners: [{}] },
    })
    expect(stripped).not.toHaveProperty('icon')
    expect(stripped.data).toEqual({ actionName: 'localizeContentItem' })
  })

  // Variant C of the spike ladder proved these four are load-bearing: a flow
  // created without them is rejected, however much they look like presentation.
  it('keeps label, description, category and group', () => {
    const stripped = stripVirtualAction(virtualAction)
    expect(stripped).toMatchObject({
      label: 'Localize Content Item',
      description: 'Localizes an item',
      category: 'Amplience Dynamic Content',
      group: 'INTEGRATIONS',
    })
  })

  it('keeps the action"s schema but not the source hub"s instance options', () => {
    const stripped = stripVirtualAction(virtualAction)
    expect(stripped.config?.schema?.properties?.instanceId).toEqual({ title: 'Instance' })
  })

  it('copes with a declaration that has no instances at all', () => {
    const trigger = {
      name: 'webhook-trigger',
      baseAction: 'webhook-trigger-base',
      config: {},
      data: { webhookListeners: [{}] },
    }
    expect(stripVirtualAction(trigger)).toEqual({
      name: 'webhook-trigger',
      baseAction: 'webhook-trigger-base',
      config: {},
      data: {},
    })
  })
})

describe('fixtureFileName', () => {
  it('slugs a label, emoji and marker included', () => {
    expect(fixtureFileName('🌐 Localize Content Item [Org]')).toBe('localize-content-item-org.json')
  })

  it('falls back rather than producing a nameless file', () => {
    expect(fixtureFileName('🌐')).toBe('flow.json')
    expect(fixtureFileName(undefined)).toBe('flow.json')
  })
})

describe('toFixture', () => {
  it('accepts the API"s stringified flow and stores real JSON', () => {
    const { fixture } = toFixture(
      {
        label: 'Localize',
        description: 'd',
        status: 'ACTIVE',
        flow: JSON.stringify(graph),
        sourceHubId: 'h',
      },
      registry,
    )
    expect(typeof fixture.flow).toBe('object')
    expect(fixture).toMatchObject({
      label: 'Localize',
      description: 'd',
      status: 'ACTIVE',
      sourceHubId: 'h',
    })
  })

  it('omits what the export did not carry rather than writing nulls', () => {
    const { fixture } = toFixture({ label: 'Localize', flow: graph }, registry)
    expect(Object.keys(fixture)).toEqual(['label', 'extensionInstances', 'flow'])
  })
})

describe('instance handles', () => {
  it('splits the version out of a title', () => {
    expect(parseInstanceTitle('Amplience Dynamic Content (v2.2.0)')).toEqual({
      label: 'Amplience Dynamic Content',
      version: '2.2.0',
    })
  })

  it('copes with a title carrying no version', () => {
    expect(parseInstanceTitle('Mango Fashion DC Integration')).toEqual({
      label: 'Mango Fashion DC Integration',
    })
    expect(instanceHandle('Mango Fashion DC Integration')).toBe('Mango Fashion DC Integration')
  })

  // Pinning the version means a hub on an older release is caught rather than
  // silently used — at the cost of re-pulling fixtures after a version bump.
  it('pins the version in the handle', () => {
    expect(instanceHandle('Amplience Dynamic Content (v2.2.0)')).toBe(
      'Amplience Dynamic Content@2.2.0',
    )
  })

  it('reads titles out of the instance picker, which is the only place they appear', () => {
    const titles = instanceTitles([
      picker([{ const: INSTANCE, title: 'Amplience Dynamic Content (v2.2.0)' }]),
    ])
    expect(titles.get(INSTANCE)).toBe('Amplience Dynamic Content (v2.2.0)')
  })

  it('is empty rather than throwing on a declaration with no picker', () => {
    expect(instanceTitles([{ name: 'webhook-trigger' }])).toEqual(new Map())
    expect(instanceTitles(undefined)).toEqual(new Map())
  })
})
