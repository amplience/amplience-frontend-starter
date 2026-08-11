/**
 * Pure logic for the webhooks seed step (hub-import.mjs `webhooks`).
 *
 * The step talks to the Management API through dc-management-sdk-js rather
 * than dc-cli, because `dc-cli webhook import` drops the top-level `secret`
 * and filters out every header marked `"secret": true` — precisely the fields
 * a webhook needs to authenticate against a protected endpoint. See
 * webhooks/README.md for the full reasoning.
 *
 * Everything here is pure: definitions in, desired webhooks and a diff out.
 * The calling script owns the API round-trips, so this module is testable
 * without a hub.
 */

import { resolveTokens } from './resolve-placeholders.mjs'

/**
 * Label prefix marking a webhook as managed by this tooling.
 *
 * The seed matches, updates and deletes on the label, and confines itself to
 * labels carrying this prefix. A hub is shared configuration — a colleague's
 * hand-made webhook, or one belonging to another integration, must survive
 * both a re-seed and a wipe.
 */
export const MANAGED_LABEL_PREFIX = 'Quadratic — '

/** Fields the Management API owns; never sent from a checked-in definition. */
export const WEBHOOK_INSTANCE_FIELDS = [
  'id',
  'hubId',
  'createdBy',
  'createdDate',
  'lastModifiedBy',
  'lastModifiedDate',
  '_links',
]

/** Strip a trailing slash (or several) so `${site:url}/api/…` never doubles up. */
export function normaliseUrl(url) {
  return url.replace(/\/+$/, '')
}

/**
 * The label to show for a web app: its own label, else its name, else its
 * host. Something non-empty is required, because it's what distinguishes one
 * deployment's webhook from another's — and the label is the identity the
 * seed matches on.
 */
export function siteLabel(webApp) {
  if (typeof webApp.label === 'string' && webApp.label !== '') return webApp.label
  if (typeof webApp.name === 'string' && webApp.name !== '') return webApp.name
  // Authority (host, plus port if present) without depending on the `URL`
  // global, which this script environment's lint config doesn't expose.
  const host = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(webApp.url)?.[1]
  return host ?? webApp.url
}

/**
 * The `${secret:…}` names a definition needs, read off the raw text.
 *
 * The step uses this to *skip* a definition whose secret isn't configured,
 * rather than failing the whole seed. A webhook is optional infrastructure —
 * `pnpm hub:import` on a hub whose deployment doesn't use the custom-CSS
 * feature should still succeed, and someone who never sets the secret should
 * get a warning naming it, not a broken import.
 */
export function requiredSecrets(definition) {
  const names = new Set()
  for (const match of JSON.stringify(definition).matchAll(/\$\{secret:([^}]+)\}/g)) {
    names.add(match[1].trim())
  }
  return names
}

/**
 * Expand one definition into one desired webhook per web app, resolving
 * tokens against each.
 *
 * A definition that references no `${site:…}` token still produces one
 * webhook per app — which would collide on the label. That's reported as an
 * error rather than silently creating a single shared webhook, because the
 * two readings ("one webhook for the hub" vs "one per deployment") have very
 * different behaviour and the definition should say which it means.
 */
export function expandDefinition(definition, { webApps, hub, secrets, source }) {
  if (webApps.length === 0) return []
  const text = JSON.stringify(definition)
  const perSite = webApps.map((webApp) => {
    const site = { url: normaliseUrl(webApp.url), label: siteLabel(webApp) }
    const resolved = JSON.parse(resolveTokens(text, { hub, site, secrets, source }))
    if (typeof resolved.label !== 'string' || resolved.label === '') {
      throw new Error(`${source}: a webhook definition must have a label.`)
    }
    if (!resolved.label.startsWith(MANAGED_LABEL_PREFIX)) {
      throw new Error(
        `${source}: label "${resolved.label}" must start with "${MANAGED_LABEL_PREFIX}" — ` +
          `the seed only ever touches webhooks carrying that prefix, so a definition ` +
          `without it would be created once and then never updated or removed.`,
      )
    }
    return resolved
  })
  if (webApps.length > 1) {
    const labels = new Set(perSite.map((w) => w.label))
    if (labels.size !== perSite.length) {
      throw new Error(
        `${source}: expanding across ${webApps.length} web apps produced duplicate labels. ` +
          `Include \${site:label} in the label so each deployment's webhook is distinct.`,
      )
    }
  }
  return perSite
}

/**
 * Diff desired webhooks against what the hub already has.
 *
 * - `create`  — desired, no managed webhook with that label
 * - `update`  — desired, and a managed webhook with that label exists (carries its id)
 * - `prune`   — managed webhook on the hub that nothing desires any more
 *
 * Pruning is what keeps a webhook from outliving the deployment it points at:
 * a renamed or destroyed site leaves a webhook that fires on every publish
 * and fails every time. Unmanaged webhooks are never in any bucket.
 */
export function diffWebhooks(desired, existing) {
  const managed = existing.filter(
    (w) => typeof w.label === 'string' && w.label.startsWith(MANAGED_LABEL_PREFIX),
  )
  const byLabel = new Map(managed.map((w) => [w.label, w]))
  const create = []
  const update = []
  for (const webhook of desired) {
    const match = byLabel.get(webhook.label)
    if (match === undefined) create.push(webhook)
    else update.push({ ...webhook, id: match.id })
  }
  const desiredLabels = new Set(desired.map((w) => w.label))
  const prune = managed.filter((w) => !desiredLabels.has(w.label))
  return { create, update, prune }
}

/**
 * Redact secret header values for logging. The seed prints what it is about
 * to do, and a webhook's whole point is carrying a credential.
 */
export function redact(webhook) {
  if (!Array.isArray(webhook.headers)) return webhook
  return {
    ...webhook,
    headers: webhook.headers.map((h) => (h.secret === true ? { ...h, value: '••••••' } : h)),
  }
}
