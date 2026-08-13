/**
 * Pure builders for the env vars the Environment Manager keeps in step with the
 * active content source. Separated from the route handlers so the mapping rules
 * — which var comes from which config field, and what a blank value means — are
 * unit-testable without touching the filesystem.
 */

/** A set of env keys to write; `undefined` means "no value" (the key is commented out). */
export type EnvVarMap = Record<string, string | undefined>

/**
 * The subset of an environment that reaches an env file. Declared structurally
 * so this module stays independent of the fuller Environment type in index.ts.
 */
export type EnvSource = {
  hubName: string
  hubId: string
  localhostUrl: string
  repoContent: string
  repoSlots: string
  repoSiteComponents: string
  revalidateSecret: string
  clientId: string
  clientSecret: string
  stagingHost: string
  defaultBrand: string
  defaultSite: string
}

/** Blank (or whitespace-only) is no value — we never want KEY="" in an env file. */
function present(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Additive update of specific keys in a .env-format string.
 * - Keys already present (active or commented) are updated in place.
 * - Keys not present are appended if they have a value; skipped otherwise.
 * - An undefined/empty value comments the key out (preserves its presence for
 *   readability) rather than removing the line entirely.
 */
export function updateEnvVars(content: string, vars: EnvVarMap): string {
  const lines = content.length > 0 ? content.split('\n') : []
  const handled = new Set<string>()

  const result = lines.map((line) => {
    const alreadyCommented = line.trimStart().startsWith('#')
    // Strip any leading comment marker to find the key
    const bare = line.replace(/^#\s*/, '')
    for (const [key, value] of Object.entries(vars)) {
      if (bare.startsWith(`${key}=`) || bare.startsWith(`${key} =`)) {
        handled.add(key)
        if (value) return `${key}="${value}"`
        // A commented line is documentation, not state — leave it. An active
        // one is blanked, so no value (or credential) lingers on disk.
        return alreadyCommented ? line : `# ${key}=`
      }
    }
    return line
  })

  // Append keys that weren't already in the file
  for (const [key, value] of Object.entries(vars)) {
    if (!handled.has(key) && value) {
      result.push(`${key}="${value}"`)
    }
  }

  const joined = result.join('\n')
  if (joined.length === 0) return ''
  return joined.endsWith('\n') ? joined : `${joined}\n`
}

/**
 * Vars for apps/web/.env — only what the web app itself reads.
 *
 * `env` is null when Local Fixtures is the active source: there is no hub, so
 * every connection var is cleared. NEXT_PUBLIC_BRAND is the exception — brand
 * is a presentation choice rather than a connection detail, so fixtures carry
 * their own, and a blank one leaves the app on its `default` theme.
 */
export function webEnvVars(env: EnvSource | null, fixturesBrand: string): EnvVarMap {
  return {
    AMPLIENCE_HUB_NAME: env === null ? undefined : present(env.hubName),
    AMPLIENCE_STAGING_HOST: env === null ? undefined : present(env.stagingHost),
    NEXT_PUBLIC_BRAND: env === null ? present(fixturesBrand) : present(env.defaultBrand),
    // Blank default site means "use the runtime default" (the hub name, ADR-0014).
    SITE_NAME: env === null ? undefined : present(env.defaultSite),
    // The local dev server accepts revalidate calls with the same secret the
    // seeded webhooks carry, so a webhook can be pointed at a tunnel while
    // debugging without a second value to keep in step.
    AMPLIENCE_REVALIDATE_SECRET: env === null ? undefined : present(env.revalidateSecret),
  }
}

/** Vars for packages/hub-management/.env — the full set the hub:* scripts consume. */
export function hubManagementEnvVars(env: EnvSource | null): EnvVarMap {
  return {
    AMPLIENCE_HUB_NAME: env === null ? undefined : present(env.hubName),
    AMPLIENCE_HUB_ID: env === null ? undefined : present(env.hubId),
    LOCALHOST_URL: env === null ? undefined : present(env.localhostUrl),
    AMPLIENCE_REPO_CONTENT: env === null ? undefined : present(env.repoContent),
    AMPLIENCE_REPO_SLOTS: env === null ? undefined : present(env.repoSlots),
    AMPLIENCE_REPO_SITE_COMPONENTS: env === null ? undefined : present(env.repoSiteComponents),
    AMPLIENCE_CLIENT_ID: env === null ? undefined : present(env.clientId),
    AMPLIENCE_CLIENT_SECRET: env === null ? undefined : present(env.clientSecret),
    AMPLIENCE_STAGING_HOST: env === null ? undefined : present(env.stagingHost),
    SITE_NAME: env === null ? undefined : present(env.defaultSite),
    AMPLIENCE_REVALIDATE_SECRET: env === null ? undefined : present(env.revalidateSecret),
  }
}
