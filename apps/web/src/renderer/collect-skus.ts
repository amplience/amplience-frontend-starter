/**
 * Collect the SKUs a content tree references (ADR-0027).
 *
 * Pure and synchronous: it knows nothing about `ProductSource`. The caller
 * resolves what this returns and hands the result back as `ctx.products`.
 *
 * Traversal mirrors the dispatcher's — same array handling, same `_meta.schema`
 * lookup, same `getChildren` — so a rail nested in a slot in a page is found
 * without a second notion of what "the tree" is.
 *
 * That includes Locale-based Content: `locale` selects the same variant the
 * dispatcher will render, so a rail inside an override that loses is never
 * collected, and one inside the variant that wins is. Without it SKUs would be
 * fetched for every locale's variants and only one rendered. The locale must be
 * the one the render will use (`ctx.locale`); omitted, the default content is
 * what is collected, matching a render with no locale.
 */

import type { Registry } from '@amplience/frontend-starter-types'

import { isLocaleContent, resolveLocaleContent, selectLocaleContent } from './locale-content'

/** Unique SKUs referenced anywhere in `content`, in first-seen order. */
export function collectSkus(
  content: unknown,
  registry: Registry,
  locale?: string,
): readonly string[] {
  const found = new Set<string>()
  // A content tree can be self-referential through a mis-authored link; track
  // visited nodes so traversal terminates.
  const seen = new WeakSet<object>()

  const walk = (node: unknown): void => {
    if (node == null || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      for (const child of resolveLocaleContent(node, locale)) walk(child)
      return
    }

    if (isLocaleContent(node)) {
      walk(selectLocaleContent(node, locale))
      return
    }

    const schemaUri = (node as { _meta?: { schema?: unknown } })._meta?.schema
    if (typeof schemaUri !== 'string') return

    const entry = registry.get(schemaUri)
    if (entry === undefined) return

    const referencedSkus = entry.referencedSkus as
      ((schema: unknown) => readonly string[]) | undefined
    if (referencedSkus !== undefined) {
      for (const sku of referencedSkus(node)) {
        if (typeof sku === 'string' && sku.length > 0) found.add(sku)
      }
    }

    const getChildren = entry.getChildren as ((schema: unknown) => readonly unknown[]) | undefined
    if (getChildren !== undefined) walk(getChildren(node))
  }

  walk(content)
  return [...found]
}
