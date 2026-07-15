// Theming application tests (QL-40).
//
// The renderer is brand-agnostic by design (ADR-0010 §9) — it never reads
// theme state, so there is no theming logic inside dispatch to test.
// "Theming applied" is instead a property of two things working together:
//
//  1. The document shell: layout.tsx hooks the deployment's brand onto
//     `<html data-brand>`, the single attribute every brand overlay keys on.
//  2. The token contract: @amplience/quadratic-theme's tokens.css defines
//     the CSS-variable families that components read and brands redefine
//     under `[data-brand]` selectors (ADR-0002).
//
// Pinning both halves here means a future multi-brand model changes where
// the attribute is set — not whether the mechanism holds.
//
// Node environment — server-rendered markup assertions, no DOM.

import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RootLayout from './layout'

// The optional CMS custom-CSS layer is exercised in lib/custom-css.test.ts;
// here it is mocked so the shell tests stay hermetic (no content client) and
// default to "no custom CSS" unless a case opts in.
const { getCustomCss } = vi.hoisted(() => ({
  getCustomCss: vi.fn<() => Promise<string | null>>(),
}))
vi.mock('../lib/custom-css', () => ({ getCustomCss }))

const tokensCss = readFileSync(
  new URL('../../../packages/theme/src/tokens.css', import.meta.url),
  'utf8',
)

// RootLayout is an async server component — resolve it, then render the element.
const renderShell = async (): Promise<string> =>
  renderToStaticMarkup(await RootLayout({ children: <p>page content</p> }))

beforeEach(() => {
  getCustomCss.mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('RootLayout brand hook', () => {
  it('defaults data-brand to "default" when no brand is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND', undefined)
    expect(await renderShell()).toContain('data-brand="default"')
  })

  it('hooks the configured brand onto <html data-brand>', async () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND', 'aurora')
    expect(await renderShell()).toContain('data-brand="aurora"')
  })

  it('renders page content inside the shell', async () => {
    expect(await renderShell()).toContain('page content')
  })
})

describe('RootLayout custom-CSS injection', () => {
  it('injects nothing when there is no custom CSS (default)', async () => {
    getCustomCss.mockResolvedValue(null)
    expect(await renderShell()).not.toContain('amplience-custom-css')
  })

  it('injects the custom CSS as a managed <style> resource', async () => {
    getCustomCss.mockResolvedValue(':root{--color-primary:#6b4eff}')
    const html = await renderShell()
    expect(html).toContain('--color-primary:#6b4eff')
    // Emitted with href+precedence so React 19 hoists/dedupes it (see layout.tsx).
    expect(html).toContain('amplience-custom-css')
  })
})

describe('design token contract', () => {
  it('defines default tokens at :root, where [data-brand] overlays can win on specificity', () => {
    expect(tokensCss).toContain(':root')
  })

  it.each(['--spacing', '--radius', '--color-', '--button-'])(
    'declares the %s token family',
    (family) => {
      expect(tokensCss).toContain(family)
    },
  )
})
