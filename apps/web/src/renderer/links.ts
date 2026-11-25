/**
 * Link fields (`partials/link`) → plain hrefs, at the render boundary.
 *
 * A link is stored as `{ type, url | page | product | category }`. Custom URLs
 * and categories (ADR-0024: the URL is the identifier) resolve here, without a
 * fetch. Pages and products need one, so `resolveLinks` in apps/web does it
 * before render and hands the result over as `ctx.links`, keyed by `linkKey`.
 *
 * The dispatcher swaps every link in a body for its href before the adapter
 * runs, so components keep taking a string and know nothing about link types.
 */

/** A stored link. Only `type` is guaranteed: an editor may pick one and leave its field empty. */
export type ContentLinkField = {
  readonly type: 'url' | 'page' | 'product' | 'category'
  readonly url?: unknown
  readonly page?: unknown
  readonly product?: unknown
  readonly category?: unknown
}

const LINK_TYPES: readonly unknown[] = ['url', 'page', 'product', 'category']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const filled = (value: unknown): value is string => typeof value === 'string' && value !== ''

/** Whether a value is a stored link (no schema uses `type` for anything else). */
export const isLinkField = (value: unknown): value is ContentLinkField =>
  isRecord(value) && LINK_TYPES.includes(value.type)

/** The `ctx.links` key for a link that needs a fetch, or `undefined`. */
export const linkKey = (link: ContentLinkField): string | undefined => {
  if (link.type === 'page' && isRecord(link.page) && filled(link.page.id)) {
    return `page:${link.page.id}`
  }
  if (link.type === 'product' && filled(link.product)) return `product:${link.product}`
  return undefined
}

/** The href a link points at, or `undefined` when it's empty or didn't resolve. */
export const hrefFor = (
  link: ContentLinkField,
  links?: ReadonlyMap<string, string>,
): string | undefined => {
  if (link.type === 'url') return filled(link.url) ? link.url : undefined
  if (link.type === 'category') return filled(link.category) ? `/${link.category}` : undefined
  const key = linkKey(link)
  return key === undefined ? undefined : links?.get(key)
}

/** Every `ctx.links` key in a content tree, de-duplicated. */
export const collectLinkKeys = (content: unknown): readonly string[] => {
  const found = new Set<string>()
  const seen = new WeakSet<object>()
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return
    seen.add(node)
    if (isLinkField(node)) {
      const key = linkKey(node)
      if (key !== undefined) found.add(key)
      return
    }
    for (const child of Object.values(node)) walk(child)
  }
  walk(content)
  return [...found]
}

const hasSchema = (value: Record<string, unknown>): boolean =>
  isRecord(value._meta) && typeof value._meta.schema === 'string'

/**
 * A copy of `node` with each link swapped for its href; an unresolved link is
 * dropped, so it renders as no link. Nested content items are left for their
 * own dispatch. Returns `node` itself when it holds no links.
 */
export const resolveLinkFields = <T>(node: T, links?: ReadonlyMap<string, string>): T => {
  const visit = (value: unknown, top: boolean): unknown => {
    if (Array.isArray(value)) {
      const next = value.map((item) => visit(item, false))
      return next.some((item, i) => item !== value[i]) ? next : value
    }
    if (!isRecord(value) || (!top && hasSchema(value))) return value
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, field] of Object.entries(value)) {
      if (isLinkField(field)) {
        changed = true
        const href = hrefFor(field, links)
        if (href !== undefined) next[key] = href
        continue
      }
      const visited = visit(field, false)
      if (visited !== field) changed = true
      next[key] = visited
    }
    return changed ? next : value
  }
  return visit(node, true) as T
}
