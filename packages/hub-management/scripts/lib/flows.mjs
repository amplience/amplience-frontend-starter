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
  const match = /^(.*)\(v([^)]+)\)\s*$/.exec(title ?? '')
  return match === null
    ? { label: (title ?? '').trim() }
    : { label: match[1].trim(), version: match[2].trim() }
}

/** The text inside `${extensionInstance:…}`: `label@version`, or just the label. */
export function instanceHandle(title) {
  const { label, version } = parseInstanceTitle(title)
  return version === undefined ? label : `${label}@${version}`
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
