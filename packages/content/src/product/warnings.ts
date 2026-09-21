/**
 * Dev-loud, production-quiet diagnostics for product sources.
 *
 * Mirrors `warnOnDuplicateSlugs` in the blog archive: a content mistake that
 * should be obvious while authoring, and silent in a deployed site where
 * nobody can act on it and the log line is just noise.
 */

// `process` and `console` via globalThis rather than node/DOM types: this
// package compiles without either (see config.ts), and a host that has
// neither simply gets no diagnostics.
type Globals = {
  process?: { env?: Record<string, string | undefined> }
  console?: { warn?: (message: string) => void }
}

const globals = globalThis as Globals

/** SKUs that were asked for but didn't resolve, in request order. */
export const missingSkus = (
  requested: readonly string[],
  resolved: readonly { readonly sku: string }[],
): readonly string[] => {
  const found = new Set(resolved.map((p) => p.sku))
  return requested.filter((sku) => !found.has(sku))
}

/**
 * Warn about SKUs a source couldn't resolve. Usually an unpublished product
 * or a typo in an authored `skus[]` list.
 */
export const warnOnMissingSkus = (missing: readonly string[]): void => {
  if (missing.length === 0) return
  if (globals.process?.env?.NODE_ENV === 'production') return
  globals.console?.warn?.(
    `[products] ${missing.length} SKU(s) did not resolve and were omitted: ${missing.join(', ')}. ` +
      `Check the product is published and the SKU matches.`,
  )
}
