/**
 * The catalogue of Workforce extensions whose ids are stable across hubs
 * (ADR-0023, QL-164).
 *
 * A flow binds to an *instance* of an extension. On a hub that has never had
 * that extension installed there is nothing to bind to, and the flow refuses —
 * correctly, but a demo hub shouldn't need a GraphQL playground and a wiki page
 * to get past it.
 *
 * ## What the catalogue actually asserts
 *
 * ⚠️ Not "this extension is public" — **"this `extensionId` means the same
 * thing on every hub"**. The two are easy to conflate and they are not the
 * same. An `Extension` belongs to a `cmsHub`, and what makes its id portable is
 * `visibility`, not who authored it:
 *
 *   PUBLIC    one record, instanced from any hub — the standard Amplience ones,
 *             which live on an Amplience-internal hub and still install here
 *   UNLISTED  likewise portable, just not advertised — a customer's own
 *             extension can be this, and then its id *is* dependable
 *   PRIVATE   usable only from its own hub, so re-creating it elsewhere makes a
 *             different record with a different id
 *
 * So a customer-authored extension is not automatically ineligible. Only the
 * genuinely per-hub case is, and that is exactly the case `resolveInstance`
 * falls back to matching on the label, because there is no stable id to use.
 *
 * ## Why there is no live version of this
 *
 * Probed 15 Oct 2026: `Query` has no list field for extensions at all — every
 * field is a single-id lookup — and `extension(id:)` cannot even verify an id,
 * since reading a public extension returns `Missing permission read on Hub …`.
 * A local list is not a shortcut here; it is the only thing available.
 *
 * ## installable
 *
 * Recording an id and being able to install it are different claims. An entry
 * may be a known-stable id we have no install recipe for — no release ids, or
 * credentials nobody here holds. `"installable": false` says so, which keeps
 * the id classified without `extensions:push` trying to create an instance that
 * cannot authenticate.
 *
 * ⚠️ `env` carries credentials — a PAT for Dynamic Content, a client id and
 * secret for Content Hub. Catalogue entries hold `${secret:…}` tokens, never
 * values: they resolve in memory at install time and are never written to disk,
 * the same rule the webhooks step applies.
 */

/** `${secret:NAME}`, `${hub:id}` and `${hub:name}` — the only tokens `env` takes. */
const SECRET = /^\$\{secret:([^}]+)\}$/
const HUB = /^\$\{hub:(id|name)\}$/

/**
 * Read a catalogue entry, failing on what makes one unusable.
 *
 * `releases` is optional: the Content Hub page installs without pinning one,
 * which the API allows — `extensionReleaseId` is nullable, and the hub picks.
 *
 * `installable` is optional and defaults to true. Setting it false records an
 * id as stable **without** claiming this repo can install it — see the note on
 * `installable` below.
 */
export function parseEntry(json, source = 'entry') {
  if (typeof json?.label !== 'string' || json.label.trim() === '') {
    throw new Error(`${source}: a catalogue entry needs a "label".`)
  }
  if (typeof json.extensionId !== 'string' || json.extensionId.trim() === '') {
    throw new Error(
      `${source}: "${json.label}" has no "extensionId". It is the one value that identifies this ` +
        `extension on every hub, so there is nothing to record without it.`,
    )
  }
  if (json.installable !== undefined && typeof json.installable !== 'boolean') {
    throw new Error(
      `${source}: "${json.label}" has a non-boolean "installable". Leave it out to mean true.`,
    )
  }

  const installable = json.installable !== false

  // ⚠️ An entry that cannot be installed has no use for an install recipe, and
  // carrying one invites someone to assume it works. Refuse rather than ignore:
  // silently-dead configuration is how a catalogue drifts out of truth.
  if (!installable && (json.releases !== undefined || Object.keys(json.env ?? {}).length > 0)) {
    throw new Error(
      `${source}: "${json.label}" is marked "installable": false but still carries ` +
        `${json.releases === undefined ? '"env"' : '"releases"'}. Nothing here would ever read ` +
        `it. Drop it, or drop the flag if the entry really can be installed.`,
    )
  }

  return {
    label: json.label,
    extensionId: json.extensionId,
    installable,
    ...(typeof json.description === 'string' ? { description: json.description } : {}),
    ...(json.releases === undefined ? {} : { releases: json.releases }),
    env: json.env ?? {},
  }
}

/** The release id for a version, or undefined when none is pinned. */
export function releaseFor(entry, version) {
  if (version === undefined) return undefined
  const id = entry?.releases?.[version]
  if (typeof id === 'string' && id.trim() !== '') return id
  const known = Object.keys(entry?.releases ?? {})
  throw new Error(
    `"${entry?.label}" has no release id on file for version ${version}` +
      (known.length === 0
        ? ". The catalogue entry pins no versions at all, so add one from the extension's install page."
        : ` — only ${known.join(', ')}. Add ${version} from the extension's install page, or pull the flow again from a hub running a version you have.`),
  )
}

/**
 * Resolve an `env` template against the environment and the target hub.
 *
 * Throws on a missing secret rather than installing an extension that cannot
 * authenticate: a half-configured instance fails at run time, inside a flow,
 * which is the worst place to discover it.
 */
export function resolveEnv(template, { env = {}, hubId, hubName, source = 'entry' } = {}) {
  const resolved = {}
  for (const [key, value] of Object.entries(template ?? {})) {
    if (typeof value !== 'string') {
      resolved[key] = value
      continue
    }

    const secret = SECRET.exec(value)
    if (secret !== null) {
      const name = secret[1].trim()
      const held = env[name]
      if (held === undefined || held.trim() === '') {
        throw new Error(
          `${source}: env.${key} needs ${name}, which is not set. The Environment Manager writes ` +
            `it into packages/hub-management/.env when a hub is activated — activate the hub, or ` +
            `export it before installing.`,
        )
      }
      resolved[key] = held.trim()
      continue
    }

    const hub = HUB.exec(value)
    if (hub !== null) {
      const held = hub[1] === 'id' ? hubId : hubName
      if (held === undefined || held === '') {
        throw new Error(`${source}: env.${key} needs the hub's ${hub[1]}, which is not known.`)
      }
      resolved[key] = held
      continue
    }

    if (/^\$\{.*\}$/.test(value)) {
      throw new Error(
        `${source}: env.${key} holds ${value}, which no rule matches. Only \${secret:NAME}, ` +
          `\${hub:id} and \${hub:name} are understood here.`,
      )
    }
    resolved[key] = value
  }
  return resolved
}

/**
 * The label the instance is created with.
 *
 * Suffixed with the version so the instance's picker title parses back to the
 * `label@version` handle a fixture references. The wiki's own install pages do
 * the same, though inconsistently — which is exactly why this is computed here
 * rather than typed.
 */
export function instanceLabel(entry, version) {
  return version === undefined ? entry.label : `${entry.label} (v${version})`
}

/** The `createExtensionInstance` input. */
export function installInput(entry, { version, hubRef, env }) {
  const releaseId = releaseFor(entry, version)
  return {
    cmsHubId: hubRef,
    extensionId: entry.extensionId,
    label: instanceLabel(entry, version),
    ...(entry.description === undefined ? {} : { description: entry.description }),
    ...(releaseId === undefined ? {} : { extensionReleaseId: releaseId }),
    env,
  }
}

/** The catalogue entry for an extension id, or undefined. */
export function findEntry(catalogue, extensionId) {
  return (catalogue ?? []).find((entry) => entry.extensionId === extensionId)
}

/**
 * Merge the checked-in catalogue with the gitignored `local/` one.
 *
 * Mirrors `mergeFixtures`, but an entry has **two** identities and a clash on
 * either is fatal. Two entries sharing an `extensionId` contradict each other
 * about one extension; two sharing a label make `extensions:push "<label>"`
 * ambiguous. Neither is resolved by precedence — "which copy won" is not a
 * question anyone should be asking at a demo.
 *
 * Entries are `{ source, value }`, `source` only so a refusal can name the two
 * files rather than just the id.
 */
export function mergeCatalogue(shared = [], local = []) {
  const byId = new Map()
  const byLabel = new Map()
  const clashes = []

  for (const entry of [...shared, ...local]) {
    const { extensionId, label } = entry.value

    const sameId = byId.get(extensionId)
    if (sameId !== undefined) {
      clashes.push(
        `${extensionId} is catalogued twice — ${sameId.source} ("${sameId.value.label}") and ` +
          `${entry.source} ("${label}"). One extension cannot be two entries; the second would ` +
          `silently never be read. Delete whichever is wrong.`,
      )
      continue
    }

    const sameLabel = byLabel.get(label)
    if (sameLabel !== undefined) {
      clashes.push(
        `"${label}" is catalogued twice — ${sameLabel.source} and ${entry.source} — under ` +
          `different extension ids. \`extensions:push "${label}"\` matches on the label, so ` +
          `there is no answer to which it should install. Rename one.`,
      )
      continue
    }

    byId.set(extensionId, entry)
    byLabel.set(label, entry)
  }

  if (clashes.length > 0) throw new Error(clashes.join('\n\n'))
  return [...byId.values()].map((entry) => entry.value)
}

/**
 * The catalogue as resolution reads it: extension id → what we know about it.
 *
 * Resolution does not need the install recipe, only the two facts that change
 * its behaviour — that the id is stable, and whether telling the user to run
 * `extensions:push` would be honest.
 */
export function catalogueIndex(catalogue = []) {
  return new Map(
    catalogue.map((entry) => [
      entry.extensionId,
      { label: entry.label, installable: entry.installable !== false },
    ]),
  )
}

/**
 * What a set of fixtures needs installed that the hub has not got.
 *
 * Keyed on the manifest's `extension` rather than on the handle: the label is
 * typed by whoever ran the install, and the wiki shows three spellings of the
 * same instance, so the extension id is the only dependable identity.
 */
export function missingExtensions(fixtures, instances = []) {
  const present = new Set(instances.map((instance) => instance.extensionId))
  const needed = new Map()
  for (const fixture of fixtures ?? []) {
    for (const [handle, reference] of Object.entries(fixture?.extensionInstances ?? {})) {
      const extensionId = reference?.extension
      if (typeof extensionId !== 'string' || present.has(extensionId)) continue
      if (!needed.has(extensionId)) {
        needed.set(extensionId, { extensionId, handle, version: versionOfHandle(handle) })
      }
    }
  }
  return [...needed.values()]
}

/** The version half of a `label@version` handle, or undefined. */
export function versionOfHandle(handle) {
  const at = (handle ?? '').lastIndexOf('@')
  return at === -1 ? undefined : handle.slice(at + 1).trim() || undefined
}
