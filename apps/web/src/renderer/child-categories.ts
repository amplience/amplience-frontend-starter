/**
 * Child categories on menu items (`showChildCategories`), at the render boundary.
 *
 * A menu item linking to a category can list that category's children from the
 * product source. `collectMenuCategories` finds the categories to ask about;
 * `withChildCategories` adds the answers as ordinary menu items, ahead of any
 * authored children, so the menu components need no changes.
 */

import {
  HIERARCHY_MENU_ITEM_SCHEMA,
  MENU_ITEM_SCHEMA,
} from '@amplience/frontend-starter-components/registry'
import type { ChildCategory } from '@amplience/frontend-starter-content'

const MENU_ITEM_SCHEMAS: readonly unknown[] = [MENU_ITEM_SCHEMA, HIERARCHY_MENU_ITEM_SCHEMA]

type CategoryMenuItem = {
  readonly _meta: { readonly schema: string; readonly deliveryId?: string }
  readonly link: { readonly type: 'category'; readonly category: string }
  readonly showChildCategories?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `node` when it is a menu item linking to a category, else `undefined`. */
const asCategoryMenuItem = (node: Record<string, unknown>): CategoryMenuItem | undefined => {
  const { _meta: meta, link } = node
  if (!isRecord(meta) || !MENU_ITEM_SCHEMAS.includes(meta.schema)) return undefined
  if (!isRecord(link) || link.type !== 'category') return undefined
  return typeof link.category === 'string' && link.category !== ''
    ? (node as CategoryMenuItem)
    : undefined
}

/**
 * The categories ticked menu items in `content` link to, de-duplicated. With
 * `includeUnticked`, every category menu item's — so a preview can tick the
 * box live without another fetch.
 */
export const collectMenuCategories = (
  content: unknown,
  { includeUnticked = false } = {},
): readonly string[] => {
  const found = new Set<string>()
  const seen = new WeakSet<object>()
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return
    seen.add(node)
    if (isRecord(node)) {
      const item = asCategoryMenuItem(node)
      if (item && (includeUnticked || item.showChildCategories === true)) {
        found.add(item.link.category)
      }
    }
    for (const child of Object.values(node)) walk(child)
  }
  walk(content)
  return [...found]
}

/** A child category as a menu item of its parent's type. */
const menuItemFor = (parent: CategoryMenuItem, category: ChildCategory) => ({
  _meta: {
    schema: parent._meta.schema,
    deliveryId: `${parent._meta.deliveryId ?? parent.link.category}/${category.identifier}`,
  },
  label: category.label,
  link: { type: 'category', category: category.identifier },
})

/**
 * A copy of `content` where each ticked category menu item lists its child
 * categories first, then its own children. Returns `content` itself when
 * nothing changes.
 */
export const withChildCategories = <T>(
  content: T,
  childCategories: ReadonlyMap<string, readonly ChildCategory[]>,
): T => {
  if (childCategories.size === 0) return content
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      const next = node.map(visit)
      return next.some((item, i) => item !== node[i]) ? next : node
    }
    if (!isRecord(node)) return node

    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      const visited = visit(value)
      if (visited !== value) changed = true
      next[key] = visited
    }

    const item = asCategoryMenuItem(node)
    const categories =
      item?.showChildCategories === true ? (childCategories.get(item.link.category) ?? []) : []
    if (item && categories.length > 0) {
      const own: readonly unknown[] = Array.isArray(next.children) ? next.children : []
      next.children = [...categories.map((c) => menuItemFor(item, c)), ...own]
      changed = true
    }
    return changed ? next : node
  }
  return visit(content) as T
}
