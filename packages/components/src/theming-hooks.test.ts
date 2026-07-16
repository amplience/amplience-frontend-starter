/**
 * Stable theming-hook guard.
 *
 * Internal component styling uses CSS-module classes, whose names are hashed
 * and unstable. So that theming overrides (the CMS custom CSS and the
 * tokens.css [data-brand] overlays) can target a component reliably — e.g.
 * `.MediaCard h2 { … }` — every component's ROOT element also carries a
 * stable, static class equal to its component name.
 *
 * This test enforces the convention: any component whose root uses
 * `styles.root` must also apply `clsx('<ComponentName>', …)` on that root, so
 * the hook can't silently go missing when a new component is added. It scans
 * source (no render) so it's cheap and independent of component props.
 *
 * The hook is a documented, stable surface — like the tokens.css variable
 * contract (ADR-0002). Renaming a component or moving its root is a breaking
 * change for anyone theming against it.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Recursively collect component .tsx files (excluding tests and stories). */
function componentTsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, dirent.name)
    if (dirent.isDirectory()) {
      out.push(...componentTsxFiles(full))
    } else if (
      dirent.name.endsWith('.tsx') &&
      !dirent.name.includes('.test.') &&
      !dirent.name.includes('.stories.')
    ) {
      out.push(full)
    }
  }
  return out
}

// Resolve the component src dir from this file's location, not process.cwd()
// — the monorepo test runner runs from the repo root, not the package.
const SRC_DIR = dirname(fileURLToPath(import.meta.url))
const componentFiles = componentTsxFiles(SRC_DIR)
  .map((path) => ({ path, src: readFileSync(path, 'utf8') }))
  .filter(({ src }) => src.includes('styles.root'))

describe('component theming hooks', () => {
  it('has component files to check', () => {
    expect(componentFiles.length).toBeGreaterThan(0)
  })

  it.each(componentFiles.map(({ path }) => path))(
    '%s applies its component-name class on the root',
    (path) => {
      const src = readFileSync(path, 'utf8')
      const name =
        path
          .split('/')
          .pop()
          ?.replace(/\.tsx$/, '') ?? ''
      expect(
        src.includes(`clsx('${name}'`),
        `${name} must apply clsx('${name}', …) on its root element so theming overrides ` +
          `can target it (e.g. ".${name} h2 {}") independent of hashed CSS-module names`,
      ).toBe(true)
    },
  )
})
