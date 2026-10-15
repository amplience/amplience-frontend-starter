/**
 * Pure logic for seeding Workforce webhook listeners (ADR-0023).
 *
 * Listeners are seeded before the flows that reference them: a flow's
 * `${listener:Label}` resolves to whatever id this step created or found.
 *
 * ⚠️ A listener's security reads back as a `__typename` and nothing else — the
 * HMAC secret never comes out of the API. HMAC *can* be set (the create input
 * has an `hmac` member beside `none`), but it cannot be read, so a re-seed
 * would have nothing to put back and would quietly leave a protected endpoint
 * open to anyone who learns its URL. Nothing here touches a listener that is
 * not provably unauthenticated, and "not provably" includes a security shape
 * this code has never heard of.
 *
 * Seeding an HMAC listener is therefore possible in principle, but only from a
 * secret supplied at seed time — the same rule the webhooks step already
 * applies. Nothing does that yet.
 *
 * Identity is the label, matched exactly, as it is for flows. Nothing is ever
 * pruned: a listener this tooling did not create may still have external
 * callers pointed at its URL.
 */

import { fixtureFileName } from './flows.mjs'

/** The one security shape confirmed expressible on create and update. */
export const UNAUTHENTICATED = { none: { dangerouslyAllowUnauthenticated: true } }

/** The `__typename` a listener with no authentication reads back as. */
const SECURITY_NONE = 'WebhookListenerSecurityNone'

/** A filename for a listener's fixture, derived from its label. */
export const listenerFileName = fixtureFileName

/**
 * Is this listener safe to overwrite?
 *
 * Only an explicit `none` counts. An unrecognised member, a missing `security`
 * block, or a listener the script could not read in full all answer "no",
 * because the failure mode on the other side is a protected endpoint silently
 * becoming an open one.
 */
export function isUnauthenticated(listener) {
  return listener?.security?.__typename === SECURITY_NONE
}

/** The schema as the API carries it: a JSON string, not an object. */
export function schemaString(schema) {
  if (schema === undefined || schema === null) return undefined
  return typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2)
}

/** Deep key-sorted copy, so two spellings of one schema compare equal. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  )
}

/**
 * Compare two schemas by what they mean rather than how they are spelled.
 *
 * A JSON Schema is order-insensitive and the hub hands back whatever string it
 * was given, so comparing text would report a change every time somebody
 * reindented a fixture. An unparseable schema counts as changed rather than
 * being quietly treated as equal.
 */
export function schemaChanged(desired, existing) {
  const left = schemaString(desired)
  const right = schemaString(existing)
  if (left === right) return false
  try {
    return (
      JSON.stringify(canonical(JSON.parse(left ?? 'null'))) !==
      JSON.stringify(canonical(JSON.parse(right ?? 'null')))
    )
  } catch {
    return true
  }
}

/**
 * Decide what to do with each authored listener.
 *
 * `existing` holds the target hub's listeners, each already read in full —
 * `security` is not on the list query, so the script fetches the ones whose
 * labels match before calling this.
 */
export function diffListeners(desired, existing) {
  const byLabel = new Map()
  for (const listener of existing ?? []) {
    if (typeof listener?.label !== 'string') continue
    byLabel.set(listener.label, [...(byLabel.get(listener.label) ?? []), listener])
  }

  const plan = { create: [], update: [], unchanged: [], refused: [] }
  for (const listener of desired ?? []) {
    const matches = byLabel.get(listener.label) ?? []

    if (matches.length > 1) {
      plan.refused.push({
        listener,
        reason:
          `${matches.length} listeners on this hub are labelled "${listener.label}" ` +
          `(${matches.map((match) => match.id).join(', ')}). The label is the only handle a flow ` +
          `has, so seeding one of them would be a guess. Give them distinct labels first.`,
      })
      continue
    }

    if (matches.length === 0) {
      plan.create.push(listener)
      continue
    }

    const match = matches[0]
    if (!isUnauthenticated(match)) {
      plan.refused.push({
        listener,
        existing: match,
        reason:
          `"${listener.label}" is protected (${match.security?.__typename ?? 'security unreadable'}) ` +
          `and its secret cannot be read back, so re-seeding it would replace that protection with ` +
          `none and leave the endpoint open to anyone who has the URL. Left untouched.`,
      })
      continue
    }

    if (schemaChanged(listener.schema, match.schema)) {
      plan.update.push({ ...listener, id: match.id, url: match.url })
    } else {
      plan.unchanged.push({ ...listener, id: match.id, url: match.url })
    }
  }
  return plan
}

/**
 * The `createWebhookListener` input.
 *
 * Security is stated rather than defaulted: a listener created without it is
 * the one case where "unauthenticated" is a choice this tooling is making, and
 * it should be visible in the code that makes it.
 */
export function createInput(listener, cmsHubId) {
  return {
    cmsHubId,
    label: listener.label,
    schema: schemaString(listener.schema),
    security: UNAUTHENTICATED,
  }
}

/**
 * The `updateWebhookListener` input.
 *
 * Takes the listener's own id, so its Amplience-minted inbound URL survives and
 * external callers do not break on a re-seed.
 *
 * ⚠️ Security is deliberately **absent**. Create and update take different
 * security input types, and update's is optional — so the safe move is to send
 * nothing and leave whatever the listener has alone. An update only ever
 * reaches a listener already unauthenticated, so there is nothing to assert.
 */
export function updateInput(listener) {
  return {
    id: listener.id,
    label: listener.label,
    schema: schemaString(listener.schema),
  }
}

/** Read a fixture, failing loudly on the two things that make one unusable. */
export function parseFixture(json, source = 'fixture') {
  if (typeof json?.label !== 'string' || json.label.trim() === '') {
    throw new Error(`${source}: a listener fixture needs a "label" — it is what a flow matches on.`)
  }
  if (json.schema === undefined) {
    throw new Error(
      `${source}: "${json.label}" has no "schema". A listener's schema is the contract its ` +
        `trigger payload is validated against, so there is no sensible default.`,
    )
  }
  return { label: json.label, schema: json.schema }
}

/**
 * Turn a listener the hub returned into a fixture.
 *
 * The schema comes back as a JSON string; it is stored as real JSON so a change
 * to it reads as a diff rather than one enormous line, and push stringifies it
 * again at the call boundary.
 *
 * `sourceHubId` records where it was pulled from, as a flow fixture does.
 */
export function toListenerFixture(listener, { sourceHubId } = {}) {
  const raw = listener?.schema
  let schema = raw
  if (typeof raw === 'string') {
    try {
      schema = JSON.parse(raw)
    } catch {
      // An unparseable schema is kept verbatim rather than dropped: it is still
      // what the hub has, and a human can see what is wrong with it.
      schema = raw
    }
  }
  const warnings = isUnauthenticated(listener)
    ? []
    : [
        `"${listener?.label}" is protected (${listener?.security?.__typename ?? 'security unreadable'}). ` +
          `A fixture cannot express that — only unauthenticated listeners can be seeded — so ` +
          `listeners:push will refuse to touch it. Kept for reference.`,
      ]
  return {
    fixture: {
      label: listener?.label,
      // Which hub this came from. Flows have carried it since QL-159; without
      // it there is no way to tell later where a listener fixture was authored,
      // and the label alone proved not to be enough.
      ...(sourceHubId === undefined ? {} : { sourceHubId }),
      schema,
    },
    warnings,
  }
}
