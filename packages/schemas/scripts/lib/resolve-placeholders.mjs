/**
 * Placeholder resolution for the extensions seed step.
 *
 * Extension parameters are authored hub-independently: instead of the
 * environment-specific IDs a dc-cli export carries, the checked-in JSON uses
 * tokens that the seed resolves against the target hub at import time — the
 * same convention the types step uses for `${hub}`.
 *
 *   ${hub}            → the target hub name
 *   ${repo:content}   → the target content repository id
 *   ${status:Label}   → the target workflow-state id for that label
 *
 * Workflow-state ids can't be authored ahead of time because dc-cli's
 * `settings import` mints a fresh id per state on each new hub and records the
 * source→target pairing in its mapping file. So statuses are referenced by
 * *label* (stable, human-authored) and resolved through two joins:
 *
 *   label ──(checked-in settings)──▶ source id ──(dc-cli map)──▶ target id
 *
 * Every function here is pure and throws on the first unresolved token, so a
 * misconfigured seed fails loudly rather than pushing a dangling extension.
 */

/**
 * Build a `label → target workflow-state id` map by joining the checked-in
 * settings definition (label → source id) with dc-cli's settings mapping file
 * (source id → target id, saved as `workflowStates: [[from, to], …]`).
 *
 * Throws if two states share a label — a label is the only handle the
 * extensions have, so it has to be unique.
 */
export function buildStatusMap(settingsJson, settingsMap) {
  const workflowStates = settingsJson?.workflowStates ?? []
  const pairs = settingsMap?.workflowStates ?? []
  const sourceToTarget = new Map(pairs)

  const labelToTarget = new Map()
  const seenLabels = new Set()
  for (const state of workflowStates) {
    const { id: sourceId, label } = state
    if (label === undefined) continue
    if (seenLabels.has(label)) {
      throw new Error(
        `Duplicate workflow-state label "${label}" in the settings definition — ` +
          `labels are how extensions reference statuses, so each must be unique.`,
      )
    }
    seenLabels.add(label)
    const targetId = sourceToTarget.get(sourceId)
    if (targetId !== undefined) labelToTarget.set(label, targetId)
  }
  return labelToTarget
}

/**
 * Resolve every `${…}` token in `text`, returning the substituted string.
 *
 * `source` names the file under resolution so failures point at the offender.
 * Throws on an unknown status label, a token whose value isn't available, or
 * any leftover `${…}` — nothing dangling ever reaches dc-cli.
 */
export function resolveTokens(text, { hub, repoContent, statusMap = new Map(), source = 'input' }) {
  let result = text.replace(/\$\{status:([^}]+)\}/g, (_match, rawLabel) => {
    const label = rawLabel.trim()
    const targetId = statusMap.get(label)
    if (targetId === undefined) {
      throw new Error(
        `${source}: no workflow state labelled "${label}" was found on the hub. ` +
          `Import settings before extensions, and make sure the settings definition ` +
          `includes a state with this exact label.`,
      )
    }
    return targetId
  })

  result = result.replace(/\$\{repo:content\}/g, () => {
    if (repoContent === undefined) {
      throw new Error(
        `${source}: references \${repo:content} but AMPLIENCE_REPO_CONTENT is not set.`,
      )
    }
    return repoContent
  })

  result = result.replace(/\$\{hub\}/g, () => {
    if (hub === undefined) {
      throw new Error(`${source}: references \${hub} but AMPLIENCE_HUB_NAME is not set.`)
    }
    return hub
  })

  const leftover = result.match(/\$\{[^}]+\}/)
  if (leftover !== null) {
    throw new Error(`${source}: unresolved placeholder ${leftover[0]} — no rule matched it.`)
  }
  return result
}

/** Fields a dc-cli export carries that describe an instance, not a definition. */
export const EXTENSION_INSTANCE_FIELDS = [
  'hubId',
  'status',
  'createdBy',
  'createdDate',
  'lastModifiedBy',
  'lastModifiedDate',
]

/** Return a shallow copy of `obj` without the given keys. */
export function stripFields(obj, fields) {
  const copy = { ...obj }
  for (const field of fields) delete copy[field]
  return copy
}
