/**
 * Installing a public Workforce extension on a hub (ADR-0023).
 *
 * A flow binds to an *instance* of an extension. On a hub that has never had
 * that extension installed there is nothing to bind to, and the flow refuses —
 * correctly, but a demo hub shouldn't need a GraphQL playground and a wiki page
 * to get past it.
 *
 * The standard Amplience extensions are **public**, with an `extensionId` that
 * is the same everywhere and a release id per version. That is the whole reason
 * this is tractable: installing one is a single `createExtensionInstance` with
 * four known constants and a few environment values. Nothing here creates an
 * extension or a release — that is publishing an integration, not configuring a
 * hub, and `createExtensionRelease` takes the extension's source files.
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
 */
export function parseEntry(json, source = 'entry') {
  if (typeof json?.label !== 'string' || json.label.trim() === '') {
    throw new Error(`${source}: a catalogue entry needs a "label".`)
  }
  if (typeof json.extensionId !== 'string' || json.extensionId.trim() === '') {
    throw new Error(
      `${source}: "${json.label}" has no "extensionId". It is the one value that identifies a ` +
        `public extension across every hub, so there is nothing to install without it.`,
    )
  }
  return {
    label: json.label,
    extensionId: json.extensionId,
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
