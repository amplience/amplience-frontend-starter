// Port-leak guard (ADR-0018 §2).
//
// The product routes must reach product data only through `ProductSource`.
// If one of them imports `ContentClient`, calls `getByKey`, or names the
// product schema URI, the port has stopped being the boundary and a PIM
// adapter would no longer be a drop-in — which is the single property the
// whole design exists to provide.
//
// A source scan rather than a type-level check, in the spirit of the
// theming-hooks guard: the failure it catches is someone reaching past an
// abstraction, and that is visible in the text of the import.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const routeDir = path.dirname(fileURLToPath(import.meta.url))

/** Every route file under `/products`, recursively. */
const routeFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })

/** Things a product route must never mention. */
const FORBIDDEN = [
  { pattern: 'content-client', why: 'the content client is the CMS adapter’s concern' },
  { pattern: 'getByKey', why: 'delivery keys belong below the port' },
  { pattern: 'listBySchema', why: 'schema queries belong below the port' },
  { pattern: 'v2/content/product', why: 'the schema URI belongs below the port' },
] as const

/** Route segment config that errors under `cacheComponents` (ADR-0022). */
const FORBIDDEN_SEGMENT_CONFIG = [
  'export const dynamic',
  'export const revalidate',
  'export const fetchCache',
  'export const dynamicParams',
] as const

describe('product routes — port boundary', () => {
  const files = routeFiles(routeDir)

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(FORBIDDEN)('never references $pattern — $why', ({ pattern }) => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${path.basename(path.dirname(file))}/${path.basename(file)}`).not.toContain(
        pattern,
      )
    }
  })

  it.each(FORBIDDEN_SEGMENT_CONFIG)('declares no %s', (declaration) => {
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), path.basename(file)).not.toContain(declaration)
    }
  })

  it('reaches product data through the port', () => {
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), path.basename(file)).toContain('product-source')
    }
  })
})
