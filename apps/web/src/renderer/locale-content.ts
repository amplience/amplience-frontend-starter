/**
 * Locale-based Content — item-level localisation, resolved before render.
 *
 * Field-level localisation is the Delivery API's job: a localised field arrives
 * already collapsed to the requested locale, so components only ever see plain
 * values. That cannot express "show *different blocks* in this locale", because
 * which blocks exist is a property of the tree, not of any one field. This is
 * the layer for that: a wrapper node holding default content plus per-locale
 * overrides, replaced by whichever set applies before anything renders.
 *
 * It resolves by *splicing*, not by rendering a component. The wrapper is
 * replaced in its parent's array by the blocks it selects, so:
 *
 *   - sibling position is right — the first selected block is the page's LCP
 *     candidate exactly as if it had been authored there (ADR-0021's ladder is
 *     positional, and a wrapper that stayed in the tree would take an index);
 *   - the wrapper needs no registry entry and no DOM;
 *   - `collectSkus` can apply the same selection, so a product rail inside a
 *     variant that loses never has its SKUs fetched (ADR-0027).
 *
 * Selection is a literal, case-insensitive comparison against the active locale
 * code (`ctx.locale`, BCP 47 — `fr-FR`). Matching is exact: `fr` does not cover
 * `fr-CA`. The first override whose `locales` include the active locale wins;
 * otherwise the default content applies. An override with no content is a
 * deliberate "hide this in these locales", not an error.
 *
 * Pure and synchronous, and free of React and of deployment config — the set of
 * configured locales is not known here, so an override naming a locale the site
 * never serves is simply never selected.
 */

/** The Locale-based Content type's schema URI (its `_meta.schema`). */
export const LOCALE_CONTENT_SCHEMA = 'https://quadratic.amplience.com/v2/content/locale-content'

/** A Locale-based Content node as delivery returns it, every field optional. */
export type LocaleContentNode = {
  readonly _meta: { readonly schema: string }
  readonly defaultContent?: unknown
  readonly localeOverrides?: unknown
}

type LocaleOverride = { readonly locales?: unknown; readonly content?: unknown }

/** Whether `node` is a Locale-based Content wrapper, read off its `_meta.schema`. */
export const isLocaleContent = (node: unknown): node is LocaleContentNode =>
  typeof node === 'object' &&
  node !== null &&
  !Array.isArray(node) &&
  (node as { _meta?: { schema?: unknown } })._meta?.schema === LOCALE_CONTENT_SCHEMA

/** Delivery omits an empty array field entirely, so absent and empty are the same. */
const asNodes = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const sameLocale = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

const appliesTo = (override: LocaleOverride | null | undefined, locale: string): boolean =>
  Array.isArray(override?.locales) &&
  override.locales.some((code) => typeof code === 'string' && sameLocale(code, locale))

/**
 * The blocks one wrapper stands for in `locale`: the first matching override's
 * content, else the default content. With no `locale` there is nothing to match,
 * so the default applies.
 *
 * Returns the wrapper's own array, unresolved — a selected block may itself be a
 * wrapper. Use {@link resolveLocaleContent} to flatten those too.
 */
export const selectLocaleContent = (
  node: LocaleContentNode,
  locale: string | undefined,
): readonly unknown[] => {
  if (locale !== undefined && Array.isArray(node.localeOverrides)) {
    const match = (node.localeOverrides as readonly (LocaleOverride | null)[]).find((override) =>
      appliesTo(override, locale),
    )
    if (match != null) return asNodes(match.content)
  }
  return asNodes(node.defaultContent)
}

/**
 * Replace every Locale-based Content node in `nodes` with the blocks it selects,
 * recursively, so a wrapper nested in a wrapper's content resolves too.
 *
 * Returns `nodes` itself when it holds no wrapper, so the common case — every
 * array on every page — costs one scan and allocates nothing.
 */
export const resolveLocaleContent = (
  nodes: readonly unknown[],
  locale: string | undefined,
): readonly unknown[] => {
  if (!nodes.some(isLocaleContent)) return nodes
  return nodes.flatMap((node) =>
    isLocaleContent(node)
      ? resolveLocaleContent(selectLocaleContent(node, locale), locale)
      : [node],
  )
}
