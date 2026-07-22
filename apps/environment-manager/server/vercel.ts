// ── Vercel site provisioning helpers (ADR-0017) ────────────────────────────────
//
// Pure, side-effect-free helpers for the "Create Vercel site" flow. The spawn/
// stream/config-write orchestration lives in index.ts; everything here is
// deterministic so it can be unit-tested without a Vercel CLI or network.

/** The subset of an Environment these helpers read. Kept structural so the
 *  server's fuller Environment type satisfies it without a shared import.
 *  Note: no stagingHost — VSE/staging is a local-dev + visualizer/preview
 *  concern (passed as a request parameter there), never a production env var. */
export type SiteEnvSource = {
  hubName: string
  defaultBrand: string
  defaultSite: string
  /** Opt-in CMS custom-CSS (ADR-0016) — pushed only when the env uses it. */
  customCss?: boolean
}

/** Per-site values collected by the create form. */
export type VercelSiteInput = {
  /** Brand theme selector → NEXT_PUBLIC_BRAND. Blank = env default. */
  brand: string
  /** Delivery-key namespace → SITE_NAME (ADR-0014). Blank = hub-name default. */
  sitename: string
  /** Optional explicit Vercel project name; blank = derived (see deriveProjectName). */
  projectName?: string
}

/** A Vercel env var to push: name, value, and which target environments. */
export type VercelEnvVar = {
  key: string
  value: string
  /** Vercel environments the var applies to. */
  targets: readonly ('production' | 'preview' | 'development')[]
}

const RUNTIME_TARGETS = ['production', 'preview'] as const

/**
 * The runtime environment variables to push to a provisioned site.
 *
 * Deliberately minimal (ADR-0017 §3): only vars that change the app's
 * behaviour away from its own defaults are pushed, so the Vercel project stays
 * clean. Specifically —
 *  - AMPLIENCE_HUB_NAME is always set: the one switch from fixtures to a hub.
 *  - SITE_NAME is set only when it differs from the hub name (it defaults to
 *    the hub name, ADR-0014), so same-name sites push nothing.
 *  - NEXT_PUBLIC_BRAND is set only for a real, non-"default" brand ("default"
 *    is the app's own fallback, so setting it would be redundant).
 *  - AMPLIENCE_STAGING_HOST is never set: VSE/staging is for local dev and the
 *    visualizer/preview (passed as a parameter there), not a production var.
 *  - SITE_URL is omitted: Vercel injects VERCEL_PROJECT_PRODUCTION_URL, which
 *    the app already falls back to.
 * The management clientId/clientSecret are never included — delivery reads a
 * hub by name, not by OAuth.
 */
export function runtimeEnvVars(env: SiteEnvSource, site: VercelSiteInput): VercelEnvVar[] {
  const hubName = env.hubName.trim()
  const brand = site.brand.trim() || env.defaultBrand.trim()
  const sitename = site.sitename.trim() || env.defaultSite.trim()

  const candidates: { key: string; value: string }[] = [
    { key: 'AMPLIENCE_HUB_NAME', value: hubName },
  ]
  // Only when it actually overrides the hub-name default (ADR-0014).
  if (sitename !== '' && sitename !== hubName) {
    candidates.push({ key: 'SITE_NAME', value: sitename })
  }
  // Only for a real brand — blank or "default" is the app's own default.
  if (brand !== '' && brand !== 'default') {
    candidates.push({ key: 'NEXT_PUBLIC_BRAND', value: brand })
  }
  // CMS custom CSS (ADR-0016) is opt-in per environment; only push the flag
  // when the environment actually uses it, so the default stays pure-static.
  if (env.customCss === true) {
    candidates.push({ key: 'AMPLIENCE_CUSTOM_CSS', value: 'TRUE' })
  }

  return candidates
    .filter((c) => c.value !== '')
    .map((c) => ({ key: c.key, value: c.value, targets: RUNTIME_TARGETS }))
}

/**
 * Derive a Vercel-safe project name from the environment + site name.
 *
 * Vercel project names are lowercase, may contain letters, digits and hyphens,
 * cannot start/end with a hyphen or run hyphens together, and cap at 100 chars.
 * An explicit projectName (if provided) is sanitised the same way so the caller
 * can't smuggle in an invalid name.
 */
export function deriveProjectName(envName: string, site: VercelSiteInput): string {
  const explicit = (site.projectName ?? '').trim()
  // Build from only the non-empty parts, so a fully-empty input falls through
  // to the stable default below rather than producing a stray "web".
  const base =
    explicit !== ''
      ? explicit
      : [envName, site.sitename || site.brand].filter((p) => p !== '').join('-')
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-') // non-alphanumerics → hyphen
    .replace(/-+/g, '-') // collapse runs
    .replace(/^-+|-+$/g, '') // trim leading/trailing
    .slice(0, 100)
  // Vercel rejects an empty name; fall back to a stable default.
  return slug || 'quadratic-lite-web'
}

/**
 * Strip ANSI escape (CSI) sequences from CLI output. The Vercel CLI wraps the
 * printed URL in bold codes; left in, those bytes get captured as part of the
 * URL and later rejected by the CMS as an invalid URI.
 */
export function stripAnsi(input: string): string {
  // Matches ANSI CSI sequences: ESC, "[", parameter bytes, intermediate
  // bytes, final byte. A regex *literal* (not runtime-compiled) so it satisfies
  // the no-runtime-regex rule; \u001b trips no-control-regex, which is
  // intentional. Linear pattern — the parameter class [0-9;?] and intermediate
  // class [ -/] (0x20-0x2f) are disjoint, so there is no backtracking.
  // eslint-disable-next-line no-control-regex
  return input.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

/**
 * Extract the deployment URL from `vercel deploy` output.
 *
 * The CLI prints the production URL on its own line (often prefixed by a status
 * glyph and/or a "Production: " label) and wraps it in ANSI codes, so we strip
 * those first. We take the last https://…vercel.app (or custom-domain) URL
 * seen, since the final one is the resolved deployment. Returns null when no
 * URL is present (e.g. the deploy failed before printing).
 */
export function parseDeploymentUrl(output: string): string | null {
  const matches = stripAnsi(output).match(/https?:\/\/[^\s"')]+/g)
  if (matches === null || matches.length === 0) return null
  // Prefer a vercel.app / vercel.dev host; else the last URL printed.
  const vercelUrls = matches.filter((u) => /\.vercel\.(app|dev)\b/.test(u))
  const chosen = (vercelUrls.length > 0 ? vercelUrls : matches).at(-1) ?? null
  return chosen === null ? null : chosen.replace(/[.,]+$/, '')
}

/**
 * Build the `vercel env add <key> <target>` argv for a single var/target pair.
 * The value itself is written to the child's stdin (not passed as an argument),
 * so it never lands in a process listing. `--yes` overwrites an existing value
 * non-interactively so re-running the flow is idempotent.
 */
export function envAddArgs(
  key: string,
  target: 'production' | 'preview' | 'development',
  opts: { token?: string; scope?: string } = {},
): string[] {
  return [
    'env',
    'add',
    key,
    target,
    '--yes',
    ...(opts.scope ? ['--scope', opts.scope] : []),
    ...(opts.token ? ['--token', opts.token] : []),
  ]
}

/** Build the `vercel deploy --prod` argv. */
export function deployArgs(opts: { token?: string; scope?: string } = {}): string[] {
  return [
    'deploy',
    '--prod',
    '--yes',
    ...(opts.scope ? ['--scope', opts.scope] : []),
    ...(opts.token ? ['--token', opts.token] : []),
  ]
}

/** Build the `vercel link` argv used to create/associate a single project. */
export function linkArgs(
  projectName: string,
  opts: { token?: string; scope?: string } = {},
): string[] {
  return [
    'link',
    '--yes',
    '--project',
    projectName,
    ...(opts.scope ? ['--scope', opts.scope] : []),
    ...(opts.token ? ['--token', opts.token] : []),
  ]
}

/**
 * Build the `vercel project ls --format json` argv used to check name
 * availability. Runs in the same scope the link will use, so no separate team
 * resolution is needed. `vercel project ls` has no substring filter (CLI v56),
 * so the caller pages through results with the `--next` cursor from
 * parseNextCursor to be sure a colliding name isn't hidden on a later page.
 */
export function projectListArgs(
  opts: { token?: string; scope?: string } = {},
  cursor?: string,
): string[] {
  return [
    'project',
    'ls',
    '--format',
    'json',
    ...(cursor !== undefined && cursor !== '' ? ['--next', cursor] : []),
    ...(opts.scope ? ['--scope', opts.scope] : []),
    ...(opts.token ? ['--token', opts.token] : []),
  ]
}

/**
 * Read the pagination cursor from `vercel project ls --format json` output,
 * or null when there are no more pages (flat array, or no/empty
 * `pagination.next`). The value feeds the next call's `--next` cursor.
 */
export function parseNextCursor(output: string): string | null {
  const clean = stripAnsi(output)
  const start = clean.search(/[[{]/)
  if (start === -1) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(clean.slice(start))
  } catch {
    return null
  }
  // One guarded cast to the only shape we read; optional chaining keeps it safe
  // for arrays or objects with no pagination.
  const next = (parsed as { pagination?: { next?: unknown } }).pagination?.next
  if (typeof next === 'string') return next
  if (typeof next === 'number') return String(next)
  return null
}

/**
 * Parse project names out of `vercel project ls --format json` output. Tolerant
 * of a top-level array or a `{ projects: [...] }` object, and of any log lines
 * printed before the JSON. Returns [] if nothing parseable is found (the caller
 * then proceeds with the requested name rather than blocking).
 */
export function parseProjectNames(output: string): string[] {
  const clean = stripAnsi(output)
  const start = clean.search(/[[{]/)
  if (start === -1) return []
  let data: unknown
  try {
    data = JSON.parse(clean.slice(start))
  } catch {
    return []
  }
  const list: unknown = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && 'projects' in data
      ? data.projects
      : []
  if (!Array.isArray(list)) return []
  const names: string[] = []
  for (const item of list) {
    if (typeof item === 'object' && item !== null && 'name' in item) {
      const n = (item as { name: unknown }).name
      if (typeof n === 'string' && n !== '') names.push(n)
    }
  }
  return names
}

/**
 * Return the first free name in the `base`, `base-2`, `base-3`, … sequence
 * given the set of taken names — so provisioning creates a fresh project
 * instead of adopting (and overwriting) an existing one.
 */
export function nextAvailableName(base: string, taken: Iterable<string>): string {
  const set = new Set(taken)
  if (!set.has(base)) return base
  for (let i = 2; i <= 1000; i++) {
    const candidate = `${base}-${i}`
    if (!set.has(candidate)) return candidate
  }
  // Pathological fallback — 999 same-named projects. Keep it unique, fail-safe.
  return `${base}-${Date.now()}`
}

/**
 * Build the `vercel env rm <key> <target> --yes` argv.
 * Run before `env add` so re-provisioning is idempotent — `vercel env add`
 * errors if the variable already exists, so we remove-then-add. A remove that
 * finds nothing exits non-zero and is deliberately ignored by the caller.
 */
export function envRmArgs(
  key: string,
  target: 'production' | 'preview' | 'development',
  opts: { token?: string; scope?: string } = {},
): string[] {
  return [
    'env',
    'rm',
    key,
    target,
    '--yes',
    ...(opts.scope ? ['--scope', opts.scope] : []),
    ...(opts.token ? ['--token', opts.token] : []),
  ]
}

/**
 * Candidate locations for the Vercel CLI's stored auth token (`auth.json`),
 * most-specific first. The CLI persists its login token here after
 * `vercel login`; reading it lets us make the one API call the CLI can't
 * (setting Root Directory) without asking the operator for a separate token.
 * Modern CLIs use an xdg-app-paths dir under "com.vercel.cli"; older ones used
 * ~/.vercel. Pure so the path logic is unit-testable.
 */
export function cliAuthTokenPaths(opts: {
  home: string
  platform: NodeJS.Platform
  xdgDataHome?: string
  xdgConfigHome?: string
  localAppData?: string
}): string[] {
  const { home, platform, xdgDataHome, xdgConfigHome, localAppData } = opts
  const paths: string[] = []
  if (platform === 'darwin') {
    paths.push(`${home}/Library/Application Support/com.vercel.cli/auth.json`)
  }
  if (platform === 'win32' && localAppData !== undefined && localAppData !== '') {
    paths.push(`${localAppData}/com.vercel.cli/auth.json`)
  }
  paths.push(`${xdgDataHome ?? `${home}/.local/share`}/com.vercel.cli/auth.json`)
  paths.push(`${xdgConfigHome ?? `${home}/.config`}/com.vercel.cli/auth.json`)
  paths.push(`${home}/.vercel/auth.json`) // legacy
  return paths
}

/** Extract the bearer token from an `auth.json`'s contents; null if absent/invalid. */
export function extractToken(authJson: string): string | null {
  try {
    const data = JSON.parse(authJson) as { token?: unknown }
    return typeof data.token === 'string' && data.token !== '' ? data.token : null
  } catch {
    return null
  }
}
