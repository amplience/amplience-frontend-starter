import { describe, expect, it } from 'vitest'

import {
  clearReviewers,
  createFlowInput,
  decodeOpaqueId,
  fixtureFileName,
  iconInput,
  iconOf,
  instanceHandle,
  instanceTitles,
  materialiseVirtualActions,
  opaqueType,
  parseInstanceTitle,
  planPush,
  resolveGraph,
  stripVirtualAction,
  toFixture,
  tokeniseGraph,
  untokenisedReferences,
  updateFlowInput,
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

  // The wiki's install pages use "(v2.2.0)"; the hub Douglas installed from
  // reads "(2.2.0)". Whoever runs the mutation types the label, so both exist.
  it('accepts a version with or without the v', () => {
    expect(parseInstanceTitle('Amplience Dynamic Content (2.2.0)')).toEqual({
      label: 'Amplience Dynamic Content',
      version: '2.2.0',
    })
    expect(instanceHandle('Amplience Dynamic Content (2.2.0)')).toBe(
      'Amplience Dynamic Content@2.2.0',
    )
  })

  it('leaves a parenthetical that is not a version alone', () => {
    expect(parseInstanceTitle('Amplience Dynamic Content (Staging)')).toEqual({
      label: 'Amplience Dynamic Content (Staging)',
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

// ── Push ──────────────────────────────────────────────────────────────────────

const RELEASE = opaque('ExtensionRelease:c7138070-c502-4da6-a98b-dff085d7e22f')
const RELEASE_B = opaque('ExtensionRelease:68ec1dbe-9bc9-4924-8b28-dca9e693310c')

/** The target hub, as its own registry reports it. */
const target = {
  extensionInstances: [
    {
      id: INSTANCE,
      extensionId: EXTENSION,
      label: 'Amplience Dynamic Content',
      version: '2.2.0',
      releaseId: RELEASE,
    },
  ],
  listeners: [{ id: LISTENER, label: 'Localize trigger', schema: '{"type":"object"}' }],
  workflowStates: [{ id: STATE, label: 'Ready for Translation' }],
}

const fixtureOf = (overrides: Record<string, unknown> = {}) => {
  const { fixture } = toFixture({ label: 'Localize', flow: graph }, registry)
  return { ...fixture, ...overrides }
}

/** A fixture with one action's config replaced — no index assignment. */
const withConfig = (index: number, config: Record<string, unknown>) => {
  const fixture = fixtureOf()
  return {
    ...fixture,
    flow: {
      ...fixture.flow,
      actions: fixture.flow.actions.map((action, at) =>
        at === index ? { ...action, config } : action,
      ),
    },
  }
}

/** A fixture with one more action-type declaration. */
const withDeclaration = (declaration: Record<string, unknown>) => {
  const fixture = fixtureOf()
  return {
    ...fixture,
    flow: {
      ...fixture.flow,
      virtualActions: [...(fixture.flow.virtualActions ?? []), declaration],
    },
  }
}

describe('resolveGraph', () => {
  it('resolves all three sites back to the target hub"s own ids', () => {
    const { flow, warnings } = resolveGraph(fixtureOf(), target, { hub: 'quadraticdemo' })
    expect(flow.actions?.[1]?.config?.instanceId).toBe(INSTANCE)
    expect(flow.actions?.[0]?.config?.['amp:webhookId']).toBe(LISTENER)
    expect(flow.edges?.[0]?.inputs?.workflowStateId).toBe(STATE)
    expect(warnings).toEqual([])
  })

  it('leaves everything else exactly as authored', () => {
    const { flow } = resolveGraph(fixtureOf(), target)
    expect(flow.actions?.[2]?.config).toEqual({ model: MODEL })
    expect(flow.edges?.[1]?.inputs).toEqual({ locales: ['de-DE'] })
    expect(flow.actions?.map((action) => action.id)).toEqual(['a1', 'a2', 'a3', 'a4'])
  })

  // Tier 2. A hub holding one instance of the extension is unambiguous even
  // when the version moved on, but binding a different contract is worth saying.
  it('falls back to the only instance of the extension, and warns', () => {
    const olderHub = {
      ...target,
      extensionInstances: [
        {
          id: INSTANCE_B,
          extensionId: EXTENSION,
          label: 'Amplience Dynamic Content',
          version: '2.1.0',
          releaseId: RELEASE_B,
        },
      ],
    }
    const { flow, warnings } = resolveGraph(fixtureOf(), olderHub, { hub: 'mango' })
    expect(flow.actions?.[1]?.config?.instanceId).toBe(INSTANCE_B)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Amplience Dynamic Content@2.1.0')
  })

  // Tier 3. Exactly the case the old extension-id token got wrong.
  it('refuses rather than picking between two instances of the extension', () => {
    const crowded = {
      ...target,
      extensionInstances: [
        { id: INSTANCE_B, extensionId: EXTENSION, label: 'Stock DC', version: '2.1.0' },
        { id: 'third', extensionId: EXTENSION, label: 'Customer DC', version: '2.1.0' },
      ],
    }
    expect(() => resolveGraph(fixtureOf(), crowded, { hub: 'mango' })).toThrow(
      /no instance named "Amplience Dynamic Content@2\.2\.0".*Stock DC@2\.1\.0/s,
    )
  })

  it('names the token and the hub when the extension is absent entirely', () => {
    const bare = { ...target, extensionInstances: [] }
    expect(() => resolveGraph(fixtureOf(), bare, { hub: 'quadraticdemo' })).toThrow(
      /\$\{extensionInstance:Amplience Dynamic Content@2\.2\.0\}.*hub "quadraticdemo"/s,
    )
  })

  it('refuses when the target hub names two instances the same', () => {
    const twins = {
      ...target,
      extensionInstances: [
        ...target.extensionInstances,
        {
          id: INSTANCE_B,
          extensionId: EXTENSION,
          label: 'Amplience Dynamic Content',
          version: '2.2.0',
        },
      ],
    }
    expect(() => resolveGraph(fixtureOf(), twins)).toThrow(/are all named/)
  })

  it('refuses without a manifest entry to fall back through', () => {
    expect(() =>
      resolveGraph(fixtureOf({ extensionInstances: {} }), { ...target, extensionInstances: [] }),
    ).toThrow(/records no extension to fall back to/)
  })

  it('points at listeners:push when a listener is missing', () => {
    expect(() => resolveGraph(fixtureOf(), { ...target, listeners: [] })).toThrow(
      /no webhook listener labelled "Localize trigger".*listeners:push/s,
    )
  })

  it('refuses two listeners with one label rather than picking', () => {
    const twins = [
      { id: LISTENER, label: 'Localize trigger' },
      { id: 'other', label: 'Localize trigger' },
    ]
    expect(() => resolveGraph(fixtureOf(), { ...target, listeners: twins })).toThrow(/ambiguous/)
  })

  it('points at the settings step when a workflow state is missing', () => {
    expect(() => resolveGraph(fixtureOf(), { ...target, workflowStates: [] })).toThrow(
      /no workflow state labelled "Ready for Translation".*Import settings/s,
    )
  })

  // The whole reason resolution reads sites rather than scanning for `${…}`.
  it('leaves a ${…} inside instruction prose alone', () => {
    const fixture = withConfig(2, { prompt: 'Write about ${brand} in a warm voice' })
    const { flow } = resolveGraph(fixture, target)
    expect(flow.actions?.[2]?.config?.prompt).toBe('Write about ${brand} in a warm voice')
  })

  it('refuses a token at a known site that no rule matches', () => {
    const fixture = withConfig(1, { instanceId: '${repo:content}' })
    expect(() => resolveGraph(fixture, target)).toThrow(/no rule matches/)
  })

  it('warns rather than throwing when a site was never tokenised', () => {
    const fixture = withConfig(1, { instanceId: INSTANCE })
    const { flow, warnings } = resolveGraph(fixture, target, { hub: 'quadraticdemo' })
    expect(flow.actions?.[1]?.config?.instanceId).toBe(INSTANCE)
    expect(warnings[0]).toContain('not tokenised')
  })
})

describe('materialiseVirtualActions', () => {
  it('replays the instances, releases and picker the fixture dropped', () => {
    const { flow } = resolveGraph(fixtureOf(), target)
    const declaration = flow.virtualActions?.find((v) => v.name === 'ext-localize')
    expect(declaration?.data).toMatchObject({
      actionName: 'localizeContentItem',
      instances: [{ id: INSTANCE, releaseId: RELEASE }],
      releases: [{ id: RELEASE }],
    })
    expect(declaration?.config?.schema?.properties?.instanceId).toMatchObject({
      default: INSTANCE,
      oneOf: [{ const: INSTANCE, title: 'Amplience Dynamic Content (v2.2.0)', type: 'string' }],
    })
  })

  // The source export lists a different instance set per declaration, so the
  // graph's own usage is the only trustworthy source.
  it('lists only the instances the graph actually binds', () => {
    const twoInstances = {
      ...target,
      extensionInstances: [
        ...target.extensionInstances,
        { id: INSTANCE_B, extensionId: EXTENSION, label: 'Mango DC', releaseId: RELEASE_B },
      ],
    }
    const { flow } = resolveGraph(fixtureOf(), twoInstances)
    const declaration = flow.virtualActions?.find((v) => v.name === 'ext-localize')
    expect(declaration?.data).toMatchObject({ instances: [{ id: INSTANCE, releaseId: RELEASE }] })
  })

  it('replays the listener and its schema into the trigger declaration', () => {
    const fixture = withDeclaration({
      name: 'webhook-trigger',
      baseAction: 'webhook-trigger-base',
      data: {},
    })
    const { flow } = resolveGraph(fixture, target)
    const trigger = flow.virtualActions?.find((v) => v.name === 'webhook-trigger')
    expect(trigger?.data).toEqual({
      webhookListeners: [{ webhookId: LISTENER, schema: '{"type":"object"}' }],
    })
  })

  it('restores no icon and no release schemas — the spike floor', () => {
    const { flow } = resolveGraph(fixtureOf(), target)
    const declaration = flow.virtualActions?.find((v) => v.name === 'ext-localize')
    expect(declaration).not.toHaveProperty('icon')
    expect(declaration?.data).toMatchObject({ releases: [{ id: RELEASE }] })
  })

  it('leaves a declaration nothing references untouched', () => {
    const fixture = withDeclaration({ name: 'ext-unused', data: { actionName: 'x' } })
    const { flow } = resolveGraph(fixture, target)
    expect(flow.virtualActions?.find((v) => v.name === 'ext-unused')).toEqual({
      name: 'ext-unused',
      data: { actionName: 'x' },
    })
  })
})

describe('materialiseVirtualActions on its own', () => {
  it('is a no-op on a graph with no declarations', () => {
    const flow = { actions: [], edges: [] }
    expect(materialiseVirtualActions(flow)).toBe(flow)
  })

  it('needs no registry entry to leave a declaration alone', () => {
    const flow = {
      virtualActions: [{ name: 'ext-localize', data: {} }],
      actions: [{ id: 'a', action: 'ext-localize', config: { instanceId: INSTANCE } }],
    }
    expect(materialiseVirtualActions(flow).virtualActions?.[0]?.data).toEqual({})
  })
})

describe('clearReviewers', () => {
  // Not a dangling reference — the Workforce UI crashes when the step is
  // opened, which is why this is unconditional rather than best-effort.
  it('empties a review step"s reviewers and counts them', () => {
    const flow = {
      actions: [
        { id: 'a', action: 'human-review', config: { reviewers: ['user-1', 'user-2'] } },
        { id: 'b', action: 'loop', config: {} },
      ],
    }
    const { flow: cleared, cleared: count } = clearReviewers(flow)
    expect(cleared.actions?.[0]?.config?.reviewers).toEqual([])
    expect(count).toBe(1)
  })

  it('keys on the field, not the action name, so a renamed step is still covered', () => {
    const flow = { actions: [{ id: 'a', action: 'approval-v2', config: { reviewers: ['u'] } }] }
    expect(clearReviewers(flow).cleared).toBe(1)
  })

  it('leaves an already-empty list untouched and counts nothing', () => {
    const flow = { actions: [{ id: 'a', action: 'human-review', config: { reviewers: [] } }] }
    const { flow: after, cleared } = clearReviewers(flow)
    expect(cleared).toBe(0)
    expect(after.actions?.[0]).toBe(flow.actions[0])
  })
})

describe('planPush', () => {
  const onHub = [
    { id: 'flow-1', label: 'Localize' },
    { id: 'flow-2', label: 'Blog' },
  ]

  it('creates when the hub has nothing by that label', () => {
    expect(planPush('Localize', [])).toEqual({ mode: 'create' })
  })

  it('updates the one match, by its own id', () => {
    expect(planPush('Localize', onHub)).toEqual({
      mode: 'update',
      id: 'flow-1',
      existing: onHub[0],
    })
  })

  // Labels are not unique on a hub — three were created in the spike without
  // complaint — so the wrong guess here silently overwrites somebody's work.
  it('refuses two matches rather than picking one', () => {
    const twins = [...onHub, { id: 'flow-3', label: 'Localize' }]
    expect(() => planPush('Localize', twins)).toThrow(/matches 2 flows.*flow-1, flow-3/s)
  })

  it('matches the label exactly, marker and all', () => {
    expect(planPush('🌐 Localize Content Item [Org]', onHub)).toEqual({ mode: 'create' })
  })
})

describe('flow mutation inputs', () => {
  const fixture = {
    label: 'Localize',
    description: 'd',
    status: 'ENABLED',
    flow: { actions: [], edges: [] },
  }
  const resolved = { actions: [{ id: 'a' }], edges: [] }

  it('stringifies the graph at the call boundary', () => {
    const input = createFlowInput(fixture, resolved, 'Q01TSHVi')
    expect(input.flow).toBe(JSON.stringify(resolved))
    expect(JSON.parse(input.flow)).toEqual(resolved)
  })

  // Status is not in the update mutation, so sending it on create would make a
  // flow's enabled state depend on whether it happened to exist yet.
  it('sends no status either way — the hub owns its own enabled state', () => {
    expect(createFlowInput(fixture, resolved, 'hub')).not.toHaveProperty('status')
    expect(updateFlowInput(fixture, resolved, 'flow-1')).not.toHaveProperty('status')
  })

  it('updates by id so the flow id, and anything bound to it, survives', () => {
    expect(updateFlowInput(fixture, resolved, 'flow-1')).toMatchObject({ id: 'flow-1' })
  })

  // `description` is String! on create and optional on update, so a fixture
  // without one still has to send something.
  it('sends an empty description rather than omitting it on create', () => {
    const bare = { label: 'Localize', flow: { actions: [], edges: [] } }
    expect(createFlowInput(bare, resolved, 'hub').description).toBe('')
    expect(updateFlowInput(bare, resolved, 'flow-1')).not.toHaveProperty('description')
  })
})

describe('flow icon', () => {
  const icon = { name: 'sparkles', color: '#a96518' }

  // A union of one member, so the read shape is the preset itself and the
  // write shape wraps it. Neither half is hub-specific.
  it('reads a preset off the API shape', () => {
    expect(iconOf(icon)).toEqual(icon)
    expect(iconInput(icon)).toEqual({ preset: icon })
  })

  it('treats a missing or half-formed icon as absent', () => {
    expect(iconOf(undefined)).toBeUndefined()
    expect(iconOf(null)).toBeUndefined()
    expect(iconOf({ name: 'sparkles' })).toBeUndefined()
    expect(iconInput(undefined)).toBeUndefined()
  })

  it('carries the icon into the fixture', () => {
    const { fixture } = toFixture({ label: 'Localize', flow: graph, icon }, registry)
    expect(fixture.icon).toEqual(icon)
  })

  it('leaves the fixture clean when the flow has no icon', () => {
    const { fixture } = toFixture({ label: 'Localize', flow: graph }, registry)
    expect(fixture).not.toHaveProperty('icon')
  })

  it('sends it on both create and update', () => {
    const fixture = { label: 'Localize', icon, flow: { actions: [], edges: [] } }
    const resolved = { actions: [], edges: [] }
    expect(createFlowInput(fixture, resolved, 'hub').icon).toEqual({ preset: icon })
    expect(updateFlowInput(fixture, resolved, 'flow-1').icon).toEqual({ preset: icon })
  })

  it('omits it rather than sending null when the fixture has none', () => {
    const bare = { label: 'Localize', flow: { actions: [], edges: [] } }
    const resolved = { actions: [], edges: [] }
    expect(createFlowInput(bare, resolved, 'hub')).not.toHaveProperty('icon')
    expect(updateFlowInput(bare, resolved, 'flow-1')).not.toHaveProperty('icon')
  })
})
