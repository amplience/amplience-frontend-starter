/**
 * Pure logic for the Workforce flow fixture format (ADR-0023).
 *
 * A flow export mixes three kinds of content, and a fixture keeps only the
 * first:
 *
 *   authored      the graph itself, and the declaration of each non-built-in
 *                 action type — what somebody actually designed.
 *   materialised  the extension instances, releases and webhook listeners
 *                 present on the hub it was exported from. Dropped here and
 *                 rebuilt from the target hub's registry at push time, because
 *                 none of it is a choice anyone made.
 *   tokenised     the handful of values that point at something hub-specific
 *                 from inside the graph. Replaced with `${…}` so the same
 *                 fixture resolves differently on each hub.
 *
 * ⚠️ `virtualActions` is mandatory — it declares each action's type, and a flow
 * missing it is rejected with one `UNKNOWN_ACTION` per affected node. Only its
 * hub-bound half goes; the declarations stay.
 *
 * ⚠️ Internal action and edge UUIDs are load-bearing: `$interpolate` sources,
 * decision-rule paths and human-review field names all reference them. Nothing
 * here regenerates one.
 *
 * Everything is pure — a flow and a registry in, a fixture and warnings out —
 * so the rules are testable without a hub.
 */

/** Per-virtual-action keys that describe the source hub rather than the action. */
const HUB_BOUND_DATA = ['instances', 'releases', 'webhookListeners']

/**
 * Dropped because it is a base64 SVG of the action's icon — a sixth of the
 * payload, redrawn from the extension registry on any hub that has it.
 */
const DROPPED_VIRTUAL_ACTION_FIELDS = ['icon']

/** The one schema property whose options are the source hub's instances. */
const INSTANCE_PROPERTY = 'instanceId'
const HUB_BOUND_INSTANCE_KEYS = ['oneOf', 'default']

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Decode an opaque Relay id (`base64("Type:value")`), or undefined. */
export function decodeOpaqueId(value) {
  if (typeof value !== 'string' || value.length < 16) return undefined
  let decoded
  try {
    decoded = Buffer.from(value, 'base64').toString('utf8')
  } catch {
    return undefined
  }
  return /^[A-Za-z]+:[\w\-/.@+]+$/.test(decoded) ? decoded : undefined
}

/** The `Type` half of an opaque id, e.g. `ExtensionInstance`. */
export function opaqueType(value) {
  return decodeOpaqueId(value)?.split(':')[0]
}

/**
 * Strip a virtual action down to its declaration.
 *
 * Keeps `label`, `description`, `category` and `group`: a flow created without
 * them fails validation, so they are authored content however much they look
 * like presentation.
 */
export function stripVirtualAction(virtualAction) {
  if (!isObject(virtualAction)) return virtualAction
  const stripped = {}
  for (const [key, value] of Object.entries(virtualAction)) {
    if (DROPPED_VIRTUAL_ACTION_FIELDS.includes(key)) continue
    if (key === 'data' && isObject(value)) {
      const data = Object.fromEntries(
        Object.entries(value).filter(([dataKey]) => !HUB_BOUND_DATA.includes(dataKey)),
      )
      stripped.data = data
      continue
    }
    if (key === 'config' && isObject(value)) {
      stripped.config = stripInstanceOptions(value)
      continue
    }
    stripped[key] = value
  }
  return stripped
}

/** Remove the source hub's instance ids from an action's own JSON schema. */
function stripInstanceOptions(config) {
  const property = config.schema?.properties?.[INSTANCE_PROPERTY]
  if (!isObject(property)) return config
  const kept = Object.fromEntries(
    Object.entries(property).filter(([key]) => !HUB_BOUND_INSTANCE_KEYS.includes(key)),
  )
  return {
    ...config,
    schema: {
      ...config.schema,
      properties: { ...config.schema.properties, [INSTANCE_PROPERTY]: kept },
    },
  }
}

export function stripVirtualActions(virtualActions) {
  return Array.isArray(virtualActions) ? virtualActions.map(stripVirtualAction) : virtualActions
}

/**
 * Instance id → the title the hub shows for it, e.g.
 * `Amplience Dynamic Content (v2.2.0)`.
 *
 * Read out of the flow's own action schemas rather than the registry: the
 * export's `data.instances[]` entries carry only ids, and the `oneOf` options
 * on the instance picker are the one place the human name appears.
 */
export function instanceTitles(virtualActions) {
  const titles = new Map()
  for (const virtualAction of virtualActions ?? []) {
    const options = virtualAction?.config?.schema?.properties?.[INSTANCE_PROPERTY]?.oneOf
    for (const option of Array.isArray(options) ? options : []) {
      if (typeof option?.const === 'string' && typeof option.title === 'string') {
        titles.set(option.const, option.title)
      }
    }
  }
  return titles
}

/**
 * Split `Amplience Dynamic Content (v2.2.0)` into its parts.
 *
 * Hubs routinely hold several instances of one extension — differing by version
 * or by what they are installed against — so the handle has to name the
 * instance, not the extension it came from.
 */
export function parseInstanceTitle(title) {
  // ⚠️ The `v` is optional. These labels are typed by whoever runs the install
  // mutation, and the wiki's own pages show three spellings of the same
  // instance — "Amplience Dynamic Content", "… (v2.2.0)" and "… (2.2.0)".
  // Requiring a digit after it keeps a real parenthetical, like "(Staging)",
  // out of the version slot.
  const match = /^(.*)\(v?(\d[^)]*)\)\s*$/.exec(title ?? '')
  return match === null
    ? { label: (title ?? '').trim() }
    : { label: match[1].trim(), version: match[2].trim() }
}

/** The text inside `${extensionInstance:…}`: `label@version`, or just the label. */
export function instanceHandle(title) {
  const { label, version } = parseInstanceTitle(title)
  return version === undefined ? label : `${label}@${version}`
}

/** The same handle, built from a registry entry rather than from a title. */
export function handleOf(instance) {
  const label = (instance?.label ?? '').trim()
  const version = (instance?.version ?? '').trim()
  return version === '' ? label : `${label}@${version}`
}

/** The inverse of `parseInstanceTitle` — what the hub shows in the picker. */
export function instanceTitle(instance) {
  const label = (instance?.label ?? '').trim()
  const version = (instance?.version ?? '').trim()
  return version === '' ? label : `${label} (v${version})`
}

/** Index a registry list by id, refusing to guess when two entries share a label. */
function labelLookup(entries, what, warnings) {
  const byId = new Map()
  const labelCounts = new Map()
  for (const entry of entries ?? []) {
    if (typeof entry?.id !== 'string' || typeof entry.label !== 'string') continue
    byId.set(entry.id, entry.label)
    labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1)
  }
  return (id) => {
    const label = byId.get(id)
    if (label === undefined) return undefined
    if ((labelCounts.get(label) ?? 0) > 1) {
      warnings.push(
        `two ${what} on this hub are both labelled "${label}", so the reference was left as the ` +
          `source hub's id — give them distinct labels and pull again.`,
      )
      return undefined
    }
    return label
  }
}

/**
 * Replace the per-hub references in a flow's graph with tokens.
 *
 * Classified by **where a value sits, not what it looks like** — a 24-character
 * workflow-state id also matches the base64 character class, so a value's shape
 * cannot tell a repository id from a workflow state. Anything unrecognised is
 * left alone and reported rather than guessed at.
 */
export function tokeniseGraph(flow, registry = {}) {
  const warnings = []
  const instances = (registry.extensionInstances ?? []).filter(
    (i) => typeof i?.id === 'string' && typeof i.extensionId === 'string',
  )
  const extensionOf = new Map(instances.map((i) => [i.id, i.extensionId]))
  const registryLabel = new Map(
    instances.filter((i) => typeof i.label === 'string').map((i) => [i.id, i.label]),
  )
  const titles = instanceTitles(flow.virtualActions)
  /** handle → what push needs to find the equivalent instance elsewhere. */
  const referenced = {}
  const listenerLabel = labelLookup(registry.listeners, 'webhook listeners', warnings)
  const stateLabel = labelLookup(registry.workflowStates, 'workflow states', warnings)

  const actions = (flow.actions ?? []).map((action) => {
    if (!isObject(action?.config)) return action
    const config = { ...action.config }

    const instanceId = config.instanceId
    if (typeof instanceId === 'string') {
      const title = titles.get(instanceId) ?? registryLabel.get(instanceId)
      const handle = title === undefined ? undefined : instanceHandle(title)
      if (handle === undefined || handle === '') {
        warnings.push(
          `extension instance ${instanceId} has no title on this hub, so there is nothing to ` +
            `match it by elsewhere and it was left as-is.`,
        )
      } else {
        config.instanceId = `\${extensionInstance:${handle}}`
        const extensionId = extensionOf.get(instanceId)
        const existing = referenced[handle]
        if (existing !== undefined && existing.sourceInstanceId !== instanceId) {
          warnings.push(
            `two instances on this hub are both "${handle}", so a push cannot tell which one ` +
              `this flow meant. Rename one, or expect whichever the target hub offers first.`,
          )
        }
        referenced[handle] = {
          ...(extensionId === undefined ? {} : { extension: extensionId }),
          sourceInstanceId: instanceId,
        }
        if (extensionId === undefined) {
          warnings.push(
            `extension instance ${instanceId} is not on this hub's registry, so the fixture ` +
              `records no extension to fall back to if "${handle}" is not on the target hub.`,
          )
        }
      }
    }

    const webhookId = config['amp:webhookId']
    if (typeof webhookId === 'string') {
      const label = listenerLabel(webhookId)
      if (label === undefined) {
        warnings.push(
          `webhook listener ${webhookId} was not found on this hub, so it was left as-is.`,
        )
      } else {
        config['amp:webhookId'] = `\${listener:${label}}`
      }
    }

    return { ...action, config }
  })

  const edges = (flow.edges ?? []).map((edge) => {
    const stateId = edge?.inputs?.workflowStateId
    if (typeof stateId !== 'string') return edge
    const label = stateLabel(stateId)
    if (label === undefined) {
      warnings.push(`workflow state ${stateId} was not found on this hub, so it was left as-is.`)
      return edge
    }
    return { ...edge, inputs: { ...edge.inputs, workflowStateId: `\${status:${label}}` } }
  })

  // Deduplicated: one ambiguous extension is one thing to fix, not one per
  // action that happens to use it.
  return {
    flow: { ...flow, actions, edges },
    extensionInstances: referenced,
    warnings: [...new Set(warnings)],
  }
}

/**
 * Opaque ids still in the graph after tokenising.
 *
 * Reported rather than rewritten. Some are genuinely global (an `Extension` id
 * is the same everywhere, and is the join key instance resolution depends on);
 * others — a brand voice, a generation model — may be hub-specific and simply
 * have no rule yet. Guessing which is which is how a flow imports cleanly and
 * then fails at run time.
 */
export function untokenisedReferences(flow) {
  const found = new Map()
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
    } else if (isObject(node)) {
      Object.values(node).forEach(visit)
    } else if (typeof node === 'string') {
      const decoded = decodeOpaqueId(node)
      if (decoded !== undefined) found.set(decoded, (found.get(decoded) ?? 0) + 1)
    }
  }
  visit({ actions: flow.actions, edges: flow.edges })
  return [...found.keys()].sort()
}

/** A filename for a flow's fixture, derived from its label. */
export function fixtureFileName(label) {
  const slug = (label ?? '')
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${slug === '' ? 'flow' : slug}.json`
}

/**
 * Build a fixture from an export.
 *
 * `flow` goes in as real JSON rather than the string the API returns, so a
 * change to a fixture reads as a diff instead of one enormous line. Push
 * stringifies it again at the call boundary.
 */
export function toFixture(exported, registry = {}) {
  const raw = typeof exported.flow === 'string' ? JSON.parse(exported.flow) : exported.flow
  const { flow, extensionInstances, warnings } = tokeniseGraph(raw, registry)
  const leftover = untokenisedReferences(flow)

  return {
    fixture: {
      label: exported.label,
      ...(exported.description === undefined ? {} : { description: exported.description }),
      ...(exported.status === undefined ? {} : { status: exported.status }),
      ...(exported.sourceHubId === undefined ? {} : { sourceHubId: exported.sourceHubId }),
      // A preset name and colour — authored, and the same on every hub, so it
      // is carried verbatim rather than tokenised.
      ...(iconOf(exported.icon) === undefined ? {} : { icon: iconOf(exported.icon) }),
      // What each `${extensionInstance:…}` handle meant on the source hub, so a
      // push that finds no instance of that name can still fall back to the one
      // instance of the same extension — the common case on a fresh hub.
      ...(Object.keys(extensionInstances).length === 0 ? {} : { extensionInstances }),
      flow: { ...flow, virtualActions: stripVirtualActions(flow.virtualActions) },
    },
    warnings,
    leftover,
  }
}

// ── Push: resolving a fixture against a target hub ────────────────────────────

/**
 * A token at one of the three sites. Anchored: a `${…}` inside instruction prose
 * is authored English, not a reference, and must survive untouched.
 */
const TOKEN = /^\$\{(extensionInstance|listener|status):([^}]*)\}$/

/** Thrown when a token cannot be resolved. Push writes nothing after one. */
export class FlowResolutionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'FlowResolutionError'
  }
}

/** Group a registry list by label, so a duplicate can be refused rather than picked. */
function byLabel(entries) {
  const groups = new Map()
  for (const entry of entries ?? []) {
    if (typeof entry?.label !== 'string') continue
    groups.set(entry.label, [...(groups.get(entry.label) ?? []), entry])
  }
  return groups
}

const on = (hub) => (hub === undefined ? 'the target hub' : `hub "${hub}"`)

/**
 * Find the instance a `${extensionInstance:…}` handle means, in three tiers.
 *
 * A hub usually holds several instances of one extension, differing by version
 * or by what they are installed against, so the handle names the instance. When
 * the target hub has no instance of that name, the manifest's extension is the
 * fallback — but only where exactly one instance of it exists, because several
 * with no name match is the case where a guess produces a flow that imports
 * cleanly and fails at run time.
 */
/** The label half of a `label@version` handle. */
function labelOfHandle(handle) {
  const at = (handle ?? '').lastIndexOf('@')
  return at === -1 ? (handle ?? '') : handle.slice(0, at)
}

function resolveInstance(handle, manifest, instances, { hub, warnings, catalogue }) {
  const named = instances.filter((instance) => handleOf(instance) === handle)
  if (named.length === 1) return named[0]
  if (named.length > 1) {
    throw new FlowResolutionError(
      `\${extensionInstance:${handle}}: ${named.length} extension instances on ${on(hub)} are ` +
        `all named "${handle}" (${named.map((i) => i.id).join(', ')}), so there is no way to tell ` +
        `which one the flow meant. Rename them so each is distinct, then push again.`,
    )
  }

  const extension = manifest?.[handle]?.extension
  const sameExtension =
    extension === undefined
      ? []
      : instances.filter((instance) => instance.extensionId === extension)

  if (sameExtension.length === 1) {
    const fallback = sameExtension[0]
    warnings.push(
      `\${extensionInstance:${handle}} resolved to "${handleOf(fallback)}" — the only instance of ` +
        `that extension on ${on(hub)}. The version or installation parameters may differ from the ` +
        `hub this flow came from, so check the action still does what it did there.`,
    )
    return fallback
  }
  if (sameExtension.length > 1) {
    throw new FlowResolutionError(
      `\${extensionInstance:${handle}}: ${on(hub)} has no instance named "${handle}", and ` +
        `${sameExtension.length} instances of its extension ` +
        `(${sameExtension.map(handleOf).join(', ')}) — any of which would import cleanly and may ` +
        `point somewhere else entirely. Rename the one you want to "${handle}", or pull the flow ` +
        `from this hub instead.`,
    )
  }

  // ⚠️ Nothing on this hub carries that extension id. If the catalogue knows
  // the id, the id is stable across hubs — so it *would* have matched if the
  // extension were here, and "not installed" is the whole story. Say that and
  // stop, rather than falling through to a label guess that could bind the
  // flow to something unrelated that happens to share a name.
  const catalogued = extension === undefined ? undefined : catalogue?.get(extension)
  if (catalogued !== undefined) {
    throw new FlowResolutionError(
      `\${extensionInstance:${handle}}: ${on(hub)} has no instance of "${catalogued.label}". ` +
        (catalogued.installable
          ? `The catalogue can install it — flows:push does that for you, but a standalone ` +
            `resolve will not. Run \`pnpm extensions:push "${catalogued.label}"\` first.`
          : `The catalogue records its id but cannot install it (no release ids, or credentials ` +
            `this repo does not hold), so install it on the hub by hand and push again.`),
    )
  }

  // Otherwise the id is one we have no reason to think is stable. An Extension
  // belongs to a hub, and a PRIVATE one re-created elsewhere is a different
  // record with a different id, so matching on the id cannot work. The label is
  // the only thing that travels — weaker evidence, so it is always reported.
  const label = labelOfHandle(handle)
  const sameLabel = instances.filter((instance) => (instance.label ?? '') === label)
  if (sameLabel.length === 1) {
    const matched = sameLabel[0]
    warnings.push(
      `\${extensionInstance:${handle}} matched "${handleOf(matched)}" on its label alone. Its ` +
        `extension id differs from the fixture's, which is normal for a custom extension — a ` +
        `custom extension installed on another hub is a different record with its own id — but it ` +
        `does mean nothing has verified this is the same integration. Check the action behaves.`,
    )
    return matched
  }
  if (sameLabel.length > 1) {
    throw new FlowResolutionError(
      `\${extensionInstance:${handle}}: ${sameLabel.length} instances on ${on(hub)} are labelled ` +
        `"${label}" (${sameLabel.map((i) => i.id).join(', ')}), and the fixture's extension id is ` +
        `not on this hub, so neither the id nor the label can pick between them.`,
    )
  }

  throw new FlowResolutionError(
    `\${extensionInstance:${handle}}: ${on(hub)} has no instance of this extension, and none ` +
      `labelled "${label}" either. Its id is not in the catalogue, so nothing here can install ` +
      `it and nothing can vouch for the id travelling between hubs — it has to exist on the hub ` +
      `first. Install or author it there, then push again. If it is in fact a portable ` +
      `extension, catalogue its id in workforce-extensions/ and this becomes a clearer refusal.`,
  )
}

/** Resolve a label against a registry list that must hold exactly one match. */
function resolveLabel(groups, label, { token, what, hub, remedy }) {
  const matches = groups.get(label) ?? []
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) {
    throw new FlowResolutionError(
      `${token}: no ${what} labelled "${label}" on ${on(hub)}. ${remedy}`,
    )
  }
  throw new FlowResolutionError(
    `${token}: ${matches.length} ${what} on ${on(hub)} are labelled "${label}", so the reference ` +
      `is ambiguous. Give them distinct labels and push again.`,
  )
}

/**
 * Turn a tokenised fixture graph into one the target hub will accept.
 *
 * Reads the same three sites the tokeniser wrote, rather than scanning for
 * `${…}` across the JSON: the tokeniser classified by site precisely because a
 * value's shape cannot be trusted, and the reverse direction has the same
 * problem plus one of its own — instruction text written for a model may
 * legitimately contain a `${…}`, and rewriting English is not this step's job.
 *
 * Throws on the first token it cannot resolve, naming the token and the hub, so
 * a half-resolved flow never reaches a customer hub.
 */
export function resolveGraph(fixture, registry = {}, { hub, catalogue } = {}) {
  const warnings = []
  const manifest = fixture?.extensionInstances ?? {}
  const flow = fixture?.flow ?? {}
  const instances = (registry.extensionInstances ?? []).filter(
    (instance) => typeof instance?.id === 'string',
  )
  const listeners = byLabel(registry.listeners)
  const states = byLabel(registry.workflowStates)
  /** Instance id → registry entry, for the materialiser that runs after this. */
  const used = new Map()

  const read = (value, site) => {
    if (typeof value !== 'string') return undefined
    const match = TOKEN.exec(value)
    if (match !== null) return { kind: match[1], name: match[2].trim() }
    if (/^\$\{.*\}$/.test(value)) {
      throw new FlowResolutionError(
        `${site} holds ${value}, which no rule matches. The fixture was written by a newer ` +
          `flows:pull than this flows:push understands — update the tooling, or fix the token.`,
      )
    }
    warnings.push(
      `${site} is not tokenised, so the source hub's own id goes to ${on(hub)} unchanged. It will ` +
        `resolve only if this is the hub the flow came from.`,
    )
    return undefined
  }

  const actions = (flow.actions ?? []).map((action) => {
    if (!isObject(action?.config)) return action
    const config = { ...action.config }
    const where = action.label ?? action.id ?? action.action ?? 'an action'

    if (config.instanceId !== undefined) {
      const token = read(config.instanceId, `"${where}": instanceId`)
      if (token?.kind === 'extensionInstance') {
        const instance = resolveInstance(token.name, manifest, instances, {
          hub,
          warnings,
          catalogue,
        })
        used.set(instance.id, instance)
        config.instanceId = instance.id
      }
    }

    if (config['amp:webhookId'] !== undefined) {
      const token = read(config['amp:webhookId'], `"${where}": amp:webhookId`)
      if (token?.kind === 'listener') {
        config['amp:webhookId'] = resolveLabel(listeners, token.name, {
          token: `\${listener:${token.name}}`,
          what: 'webhook listener',
          hub,
          remedy: 'Run listeners:push before flows:push — flows reference the listeners it seeds.',
        }).id
      }
    }

    return { ...action, config }
  })

  const edges = (flow.edges ?? []).map((edge) => {
    const stateId = edge?.inputs?.workflowStateId
    if (stateId === undefined) return edge
    const token = read(stateId, `edge ${edge.id ?? ''}: workflowStateId`.trim())
    if (token?.kind !== 'status') return edge
    const state = resolveLabel(states, token.name, {
      token: `\${status:${token.name}}`,
      what: 'workflow state',
      hub,
      remedy: 'Import settings before flows, and check the state label matches exactly.',
    })
    return { ...edge, inputs: { ...edge.inputs, workflowStateId: state.id } }
  })

  const resolved = { ...flow, actions, edges }
  return {
    flow: materialiseVirtualActions(resolved, { instances: used, listeners: registry.listeners }),
    warnings: [...new Set(warnings)],
  }
}

/**
 * Rebuild the hub-bound half of `virtualActions` from what the resolved graph
 * actually uses.
 *
 * Not from the whole registry: the source export lists a different instance set
 * per declaration — an action only offered by a newer release appears against
 * one instance where its neighbours list two — so "every instance of this
 * extension" would be wrong as often as right. What the flow references is both
 * knowable and sufficient.
 *
 * Icons and release schemas are not restored. The spike established the floor:
 * a flow creates without either, and both are redrawn by the hub.
 */
export function materialiseVirtualActions(flow, { instances = new Map(), listeners = [] } = {}) {
  const virtualActions = flow.virtualActions
  if (!Array.isArray(virtualActions)) return flow

  const listenerById = new Map(
    (listeners ?? []).filter((l) => typeof l?.id === 'string').map((l) => [l.id, l]),
  )

  /** action type → the instance and listener ids the graph binds to it, in order. */
  const usage = new Map()
  for (const action of flow.actions ?? []) {
    if (typeof action?.action !== 'string') continue
    const entry = usage.get(action.action) ?? { instanceIds: [], webhookIds: [] }
    const instanceId = action.config?.instanceId
    if (typeof instanceId === 'string' && !entry.instanceIds.includes(instanceId)) {
      entry.instanceIds.push(instanceId)
    }
    const webhookId = action.config?.['amp:webhookId']
    if (typeof webhookId === 'string' && !entry.webhookIds.includes(webhookId)) {
      entry.webhookIds.push(webhookId)
    }
    usage.set(action.action, entry)
  }

  return {
    ...flow,
    virtualActions: virtualActions.map((virtualAction) => {
      const entry = usage.get(virtualAction?.name)
      if (entry === undefined) return virtualAction

      const bound = entry.instanceIds.map((id) => instances.get(id)).filter((i) => i !== undefined)
      const seeded = entry.webhookIds
        .map((id) => listenerById.get(id))
        .filter((l) => l !== undefined)
      if (bound.length === 0 && seeded.length === 0) return virtualAction

      const data = { ...(virtualAction.data ?? {}) }
      if (bound.length > 0) {
        data.instances = bound.map((instance) => ({
          id: instance.id,
          ...(instance.releaseId === undefined ? {} : { releaseId: instance.releaseId }),
        }))
        const releaseIds = [
          ...new Set(bound.map((i) => i.releaseId).filter((id) => id !== undefined)),
        ]
        if (releaseIds.length > 0) data.releases = releaseIds.map((id) => ({ id }))
      }
      if (seeded.length > 0) {
        data.webhookListeners = seeded.map((listener) => ({
          webhookId: listener.id,
          ...(listener.schema === undefined ? {} : { schema: listener.schema }),
        }))
      }

      return {
        ...virtualAction,
        data,
        ...(bound.length === 0 ? {} : { config: withInstanceOptions(virtualAction.config, bound) }),
      }
    }),
  }
}

/** Put the target hub's instances back into an action's own instance picker. */
function withInstanceOptions(config, bound) {
  const property = config?.schema?.properties?.[INSTANCE_PROPERTY]
  if (!isObject(property)) return config
  return {
    ...config,
    schema: {
      ...config.schema,
      properties: {
        ...config.schema.properties,
        [INSTANCE_PROPERTY]: {
          ...property,
          default: bound[0].id,
          oneOf: bound.map((instance) => ({
            title: instanceTitle(instance),
            const: instance.id,
            type: 'string',
          })),
        },
      },
    },
  }
}

/**
 * A flow's icon, as a fixture stores it.
 *
 * `ContentFlowIcon` is a union whose only member is `ContentFlowIconPreset`, so
 * the read shape is `{ name, color }` and the write shape wraps the same pair
 * in `{ preset: … }`. Neither half is hub-specific — it is a preset name and a
 * colour, which is authored content.
 */
export function iconOf(icon) {
  const name = icon?.name
  const color = icon?.color
  if (typeof name !== 'string' || typeof color !== 'string') return undefined
  return { name, color }
}

/** The same pair, shaped for `CreateContentFlowInput.icon`. */
export function iconInput(icon) {
  const preset = iconOf(icon)
  return preset === undefined ? undefined : { preset }
}

// ── Push: deciding what to send ───────────────────────────────────────────────

/**
 * Empty every reviewer list in the graph.
 *
 * A `human-review` step carries the user ids of the people who may approve it,
 * and on another hub those ids mean nothing — the Workforce UI **crashes** when
 * the step is opened, rather than merely showing a dangling reference. The
 * browser extension's import already strips them for the same reason.
 *
 * Keyed on `config.reviewers` rather than on an action type, so a renamed or
 * additional review step is covered without this having to know its name.
 */
export function clearReviewers(flow) {
  let cleared = 0
  const actions = (flow.actions ?? []).map((action) => {
    if (!Array.isArray(action?.config?.reviewers) || action.config.reviewers.length === 0) {
      return action
    }
    cleared += 1
    return { ...action, config: { ...action.config, reviewers: [] } }
  })
  return { flow: { ...flow, actions }, cleared }
}

/**
 * Decide whether a fixture creates or updates, matching on the exact label.
 *
 * ⚠️ Labels are **not** unique on a hub — three same-labelled flows were
 * created in the spike without complaint — so the count has three branches, not
 * two. Two matches is a refusal rather than a guess at which to overwrite,
 * because the wrong guess silently replaces somebody's work.
 */
export function planPush(label, existing) {
  const matches = (existing ?? []).filter((flow) => flow?.label === label)
  if (matches.length === 0) return { mode: 'create' }
  if (matches.length === 1) return { mode: 'update', id: matches[0].id, existing: matches[0] }
  throw new FlowResolutionError(
    `"${label}" matches ${matches.length} flows on this hub (${matches
      .map((flow) => flow.id)
      .join(', ')}). Labels are not unique and the label is the only identity a fixture has, so ` +
      `updating one of them would be a guess. Rename or remove the duplicates first.`,
  )
}

/**
 * The `createContentFlow` input.
 *
 * ⚠️ `status` is deliberately absent from both inputs. It is not part of the
 * update mutation at all, so sending it on create and not on update would mean
 * a flow's enabled state depended on whether it happened to exist yet. A hub
 * owns its own enabled state; the fixture's `status` records what the source
 * hub had.
 */
export function createFlowInput(fixture, flow, hubRef) {
  return {
    cmsHubId: hubRef,
    label: fixture.label,
    ...(iconInput(fixture.icon) === undefined ? {} : { icon: iconInput(fixture.icon) }),
    // ⚠️ `description` is non-null on create (`String!`) and optional on update.
    // A fixture without one still has to send something, so it sends empty.
    description: fixture.description ?? '',
    flow: JSON.stringify(flow),
  }
}

/** The `updateContentFlow` input — by the flow's own id, so the id survives. */
export function updateFlowInput(fixture, flow, id) {
  return {
    id,
    label: fixture.label,
    ...(iconInput(fixture.icon) === undefined ? {} : { icon: iconInput(fixture.icon) }),
    ...(fixture.description === undefined ? {} : { description: fixture.description }),
    flow: JSON.stringify(flow),
  }
}
