import { describe, expect, it } from 'vitest'

import {
  cliAuthTokenPaths,
  deployArgs,
  deriveProjectName,
  envAddArgs,
  envRmArgs,
  extractToken,
  linkArgs,
  nextAvailableName,
  parseDeploymentUrl,
  parseNextCursor,
  parseProjectNames,
  projectListArgs,
  runtimeEnvVars,
  stripAnsi,
  type SiteEnvSource,
} from './vercel.ts'

const ESC = String.fromCharCode(27)

const ENV: SiteEnvSource = {
  hubName: 'quadraticlite',
  defaultBrand: 'default',
  defaultSite: 'quadraticlite',
}

describe('runtimeEnvVars', () => {
  it('pushes only the non-default vars, for both production and preview', () => {
    const vars = runtimeEnvVars(ENV, { brand: 'acme', sitename: 'acme-store' })
    const keys = vars.map((v) => v.key)
    // SITE_NAME differs from the hub name; brand is non-default; no staging host.
    expect(keys).toEqual(['AMPLIENCE_HUB_NAME', 'SITE_NAME', 'NEXT_PUBLIC_BRAND'])
    for (const v of vars) expect(v.targets).toEqual(['production', 'preview'])
    expect(vars.find((v) => v.key === 'SITE_NAME')?.value).toBe('acme-store')
    expect(vars.find((v) => v.key === 'NEXT_PUBLIC_BRAND')?.value).toBe('acme')
  })

  it('never pushes staging host or management OAuth credentials', () => {
    const keys = runtimeEnvVars(ENV, { brand: 'acme', sitename: 'acme-store' }).map((v) => v.key)
    expect(keys).not.toContain('AMPLIENCE_STAGING_HOST') // staging is local/preview only
    expect(keys).not.toContain('AMPLIENCE_CLIENT_ID')
    expect(keys).not.toContain('AMPLIENCE_CLIENT_SECRET')
    expect(keys).not.toContain('SITE_URL') // Vercel injects the production URL
  })

  it('omits SITE_NAME when it equals the hub name', () => {
    // Blank site → defaults to the hub name → nothing to override, so dropped.
    const blank = runtimeEnvVars(ENV, { brand: 'acme', sitename: '' })
    expect(blank.map((v) => v.key)).not.toContain('SITE_NAME')
    // Explicitly naming the hub is likewise a no-op.
    const same = runtimeEnvVars(ENV, { brand: 'acme', sitename: 'quadraticlite' })
    expect(same.map((v) => v.key)).not.toContain('SITE_NAME')
  })

  it('omits NEXT_PUBLIC_BRAND when the brand is blank or "default"', () => {
    expect(runtimeEnvVars(ENV, { brand: '', sitename: '' }).map((v) => v.key)).not.toContain(
      'NEXT_PUBLIC_BRAND',
    )
    expect(runtimeEnvVars(ENV, { brand: 'default', sitename: '' }).map((v) => v.key)).not.toContain(
      'NEXT_PUBLIC_BRAND',
    )
  })

  it('pushes only the hub name when nothing overrides the defaults', () => {
    expect(runtimeEnvVars(ENV, { brand: '', sitename: '' }).map((v) => v.key)).toEqual([
      'AMPLIENCE_HUB_NAME',
    ])
  })

  it('includes the custom-CSS flag only when the environment opts in', () => {
    const on = runtimeEnvVars({ ...ENV, customCss: true }, { brand: '', sitename: '' })
    expect(on.map((v) => v.key)).toContain('AMPLIENCE_CUSTOM_CSS')
    const off = runtimeEnvVars(ENV, { brand: '', sitename: '' })
    expect(off.map((v) => v.key)).not.toContain('AMPLIENCE_CUSTOM_CSS')
  })
})

describe('deriveProjectName', () => {
  it('derives a slug from hub + site name', () => {
    expect(deriveProjectName('clientastaging', { brand: 'acme', sitename: 'acme-store' })).toBe(
      'clientastaging-acme-store',
    )
  })

  it('falls back to the brand when there is no site name', () => {
    expect(deriveProjectName('quadraticlite', { brand: 'acme', sitename: '' })).toBe(
      'quadraticlite-acme',
    )
  })

  it('sanitises to Vercel-safe characters', () => {
    expect(deriveProjectName('Client A', { brand: 'Acme Co.', sitename: 'Acme Store!' })).toBe(
      'client-a-acme-store',
    )
  })

  it('honours an explicit project name (still sanitised)', () => {
    expect(
      deriveProjectName('hub', { brand: 'b', sitename: 's', projectName: 'My Cool Project' }),
    ).toBe('my-cool-project')
  })

  it('falls back to a stable default when nothing usable is given', () => {
    expect(deriveProjectName('', { brand: '', sitename: '' })).toBe('quadratic-lite-web')
  })
})

describe('parseDeploymentUrl', () => {
  it('extracts the vercel.app URL from typical deploy output', () => {
    const out = [
      'Vercel CLI 34.0.0',
      'Inspect: https://vercel.com/acme/proj/abc [2s]',
      'Production: https://acme-store-xyz.vercel.app [30s]',
      '',
    ].join('\n')
    expect(parseDeploymentUrl(out)).toBe('https://acme-store-xyz.vercel.app')
  })

  it('strips a trailing period', () => {
    expect(parseDeploymentUrl('Deployed to https://foo.vercel.app.')).toBe('https://foo.vercel.app')
  })

  it('returns null when no URL is present', () => {
    expect(parseDeploymentUrl('Error: build failed')).toBeNull()
  })

  it('strips ANSI escape codes the CLI wraps around the URL', () => {
    // Reproduces the real bug: bold-off code baked into the recorded URL.
    const out = `Production: ${ESC}[1mhttps://matts-sandbox-6.vercel.app${ESC}[22m`
    expect(parseDeploymentUrl(out)).toBe('https://matts-sandbox-6.vercel.app')
  })

  it('falls back to the last URL printed when the site is on a custom domain', () => {
    // A project with a production domain attached prints that domain rather
    // than a *.vercel.app host. The vercel-host preference must not strand the
    // result on the dashboard link that precedes it.
    const out = [
      'Inspect: https://vercel.com/acme/proj/abc [2s]',
      'Production: https://shop.acme.com [30s]',
    ].join('\n')
    expect(parseDeploymentUrl(out)).toBe('https://shop.acme.com')
  })
})

describe('stripAnsi', () => {
  it('removes SGR colour/bold sequences', () => {
    expect(stripAnsi(`${ESC}[1mbold${ESC}[22m and ${ESC}[32mgreen${ESC}[0m`)).toBe('bold and green')
  })

  it('leaves plain text untouched', () => {
    expect(stripAnsi('https://foo.vercel.app')).toBe('https://foo.vercel.app')
  })
})

describe('CLI argv builders', () => {
  it('builds env-add args with --yes and no value in argv', () => {
    const args = envAddArgs('SITE_NAME', 'production')
    expect(args).toEqual(['env', 'add', 'SITE_NAME', 'production', '--yes'])
    expect(args).not.toContain('acme-store') // value goes via stdin
  })

  it('threads token and scope through when provided', () => {
    expect(envAddArgs('K', 'preview', { token: 't', scope: 'team' })).toEqual([
      'env',
      'add',
      'K',
      'preview',
      '--yes',
      '--scope',
      'team',
      '--token',
      't',
    ])
    expect(deployArgs({ scope: 'team' })).toEqual(['deploy', '--prod', '--yes', '--scope', 'team'])
    expect(linkArgs('proj', { token: 't' })).toEqual([
      'link',
      '--yes',
      '--project',
      'proj',
      '--token',
      't',
    ])
  })

  it('builds idempotent env-rm args', () => {
    expect(envRmArgs('SITE_NAME', 'production')).toEqual([
      'env',
      'rm',
      'SITE_NAME',
      'production',
      '--yes',
    ])
  })

  it('threads token and scope through env-rm too', () => {
    // env rm runs immediately before env add (remove-then-add for idempotency),
    // so it has to reach the same project — dropping either flag here would
    // silently target a different scope than the add that follows it.
    expect(envRmArgs('K', 'preview', { token: 't', scope: 'team' })).toEqual([
      'env',
      'rm',
      'K',
      'preview',
      '--yes',
      '--scope',
      'team',
      '--token',
      't',
    ])
  })

  it('omits each flag independently when only the other is supplied', () => {
    // scope and token are set from separate sources (team selection vs stored
    // CLI auth), so every combination is reachable in practice.
    expect(deployArgs()).toEqual(['deploy', '--prod', '--yes'])
    expect(deployArgs({ token: 't' })).toEqual(['deploy', '--prod', '--yes', '--token', 't'])
    expect(linkArgs('proj', { scope: 'team' })).toEqual([
      'link',
      '--yes',
      '--project',
      'proj',
      '--scope',
      'team',
    ])
  })
})

describe('parseProjectNames', () => {
  it('reads names from a top-level array', () => {
    expect(parseProjectNames('[{"name":"acme"},{"name":"acme-2"}]')).toEqual(['acme', 'acme-2'])
  })

  it('reads names from a { projects: [...] } object, ignoring log preamble', () => {
    const out = 'Vercel CLI 56.2.0\n{"projects":[{"name":"foo"},{"id":"prj_x"}],"pagination":{}}'
    expect(parseProjectNames(out)).toEqual(['foo'])
  })

  it('returns [] when there is no parseable JSON', () => {
    expect(parseProjectNames('no projects found')).toEqual([])
  })

  it('returns [] for JSON that carries no project list', () => {
    // A CLI that changes its envelope, or an error object, must not throw here
    // — the caller treats [] as "nothing known to be taken" and carries on.
    expect(parseProjectNames('{"pagination":{"next":null}}')).toEqual([])
    expect(parseProjectNames('{"projects":"none"}')).toEqual([])
  })

  it('skips entries whose name is empty or not a string', () => {
    // A blank name would make nextAvailableName treat "" as taken; a numeric
    // one would land in a Set of strings and never match.
    expect(parseProjectNames('[{"name":""},{"name":42},{"name":"acme"}]')).toEqual(['acme'])
  })
})

describe('nextAvailableName', () => {
  it('returns the base name when it is free', () => {
    expect(nextAvailableName('acme', ['other'])).toBe('acme')
  })

  it('bumps to -2, then -3, skipping taken names', () => {
    expect(nextAvailableName('acme', ['acme'])).toBe('acme-2')
    expect(nextAvailableName('acme', ['acme', 'acme-2', 'acme-3'])).toBe('acme-4')
  })
})

describe('projectListArgs', () => {
  it('requests JSON and has no unsupported --filter', () => {
    expect(projectListArgs()).toEqual(['project', 'ls', '--format', 'json'])
  })

  it('adds the --next cursor when paging', () => {
    expect(projectListArgs({}, '1584722256178')).toEqual([
      'project',
      'ls',
      '--format',
      'json',
      '--next',
      '1584722256178',
    ])
  })

  it('lists in the same scope the link will use', () => {
    // Availability is checked so the flow creates a fresh project rather than
    // adopting one. Listing in a different scope than the subsequent link would
    // check the wrong account's projects and silently overwrite.
    expect(projectListArgs({ token: 't', scope: 'team' })).toEqual([
      'project',
      'ls',
      '--format',
      'json',
      '--scope',
      'team',
      '--token',
      't',
    ])
  })
})

describe('parseNextCursor', () => {
  it('returns the pagination cursor as a string', () => {
    expect(parseNextCursor('{"projects":[],"pagination":{"next":1584722256178}}')).toBe(
      '1584722256178',
    )
  })

  it('passes a string cursor through unchanged', () => {
    // The CLI has printed `next` as both a number and an opaque string across
    // versions; only the number form needs coercing.
    expect(parseNextCursor('{"pagination":{"next":"eyJvZmZzZXQiOjIwfQ"}}')).toBe(
      'eyJvZmZzZXQiOjIwfQ',
    )
  })

  it('returns null when there are no more pages or no pagination', () => {
    expect(parseNextCursor('{"projects":[],"pagination":{"next":null}}')).toBeNull()
    expect(parseNextCursor('[{"name":"acme"}]')).toBeNull()
    expect(parseNextCursor('not json')).toBeNull()
  })
})

describe('cliAuthTokenPaths', () => {
  it('puts the macOS Application Support path first', () => {
    const paths = cliAuthTokenPaths({ home: '/Users/matt', platform: 'darwin' })
    expect(paths[0]).toBe('/Users/matt/Library/Application Support/com.vercel.cli/auth.json')
    expect(paths).toContain('/Users/matt/.vercel/auth.json') // legacy fallback
  })

  it('honours XDG_DATA_HOME on linux', () => {
    const paths = cliAuthTokenPaths({
      home: '/home/matt',
      platform: 'linux',
      xdgDataHome: '/custom/data',
    })
    expect(paths).toContain('/custom/data/com.vercel.cli/auth.json')
  })

  it('puts the LOCALAPPDATA path first on Windows', () => {
    const paths = cliAuthTokenPaths({
      home: 'C:/Users/matt',
      platform: 'win32',
      localAppData: 'C:/Users/matt/AppData/Local',
    })
    expect(paths[0]).toBe('C:/Users/matt/AppData/Local/com.vercel.cli/auth.json')
    expect(paths).not.toContain(
      'C:/Users/matt/Library/Application Support/com.vercel.cli/auth.json',
    )
  })

  it('falls back to the XDG paths on Windows when LOCALAPPDATA is unset or blank', () => {
    // Node only guarantees LOCALAPPDATA on a normal desktop session; a service
    // account or stripped environment can leave it absent or empty, and an
    // empty one would build the bare path "/com.vercel.cli/auth.json".
    for (const localAppData of [undefined, '']) {
      const paths = cliAuthTokenPaths({ home: 'C:/Users/matt', platform: 'win32', localAppData })
      expect(paths[0]).toBe('C:/Users/matt/.local/share/com.vercel.cli/auth.json')
      expect(paths.some((p) => p.startsWith('/com.vercel.cli'))).toBe(false)
    }
  })
})

describe('extractToken', () => {
  it('reads the token field', () => {
    expect(extractToken('{"token":"abc123"}')).toBe('abc123')
  })

  it('returns null for missing token or invalid JSON', () => {
    expect(extractToken('{"other":"x"}')).toBeNull()
    expect(extractToken('not json')).toBeNull()
    expect(extractToken('{"token":""}')).toBeNull()
  })
})
