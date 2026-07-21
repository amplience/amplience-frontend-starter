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
  it('derives a slug from env + site name', () => {
    expect(deriveProjectName('client-a-staging', { brand: 'acme', sitename: 'acme-store' })).toBe(
      'client-a-staging-acme-store',
    )
  })

  it('sanitises to Vercel-safe characters', () => {
    expect(deriveProjectName('Client A', { brand: 'Acme Co.', sitename: 'Acme Store!' })).toBe(
      'client-a-acme-store',
    )
  })

  it('honours an explicit project name (still sanitised)', () => {
    expect(
      deriveProjectName('env', { brand: 'b', sitename: 's', projectName: 'My Cool Project' }),
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
})

describe('parseNextCursor', () => {
  it('returns the pagination cursor as a string', () => {
    expect(parseNextCursor('{"projects":[],"pagination":{"next":1584722256178}}')).toBe(
      '1584722256178',
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
