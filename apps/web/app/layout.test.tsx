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
import { afterEach, describe, expect, it, vi } from 'vitest'

import RootLayout from './layout'

const tokensCss = readFileSync(
  new URL('../../../packages/theme/src/tokens.css', import.meta.url),
  'utf8',
)

const renderShell = (): string =>
  renderToStaticMarkup(
    <RootLayout>
      <p>page content</p>
    </RootLayout>,
  )

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('RootLayout brand hook', () => {
  it('defaults data-brand to "default" when no brand is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND', undefined)
    expect(renderShell()).toContain('data-brand="default"')
  })

  it('hooks the configured brand onto <html data-brand>', () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND', 'aurora')
    expect(renderShell()).toContain('data-brand="aurora"')
  })

  it('renders page content inside the shell', () => {
    expect(renderShell()).toContain('page content')
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
