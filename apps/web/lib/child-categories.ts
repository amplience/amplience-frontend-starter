/**
 * Resolve the child categories that menu items can list (`showChildCategories`).
 *
 * Empty when the product source has no category tree — the CMS source — so
 * ticked items keep only their authored children. A category that fails to
 * resolve is left out rather than failing the page.
 */

import type { ChildCategory } from '@amplience/frontend-starter-content'

import { collectMenuCategories, withChildCategories } from '../src/renderer'
import type { Locale } from './locales'
import { productSource } from './product-source'

const EMPTY: ReadonlyMap<string, readonly ChildCategory[]> = new Map()

export async function resolveChildCategories(
  content: unknown,
  locale: Locale,
): Promise<ReadonlyMap<string, readonly ChildCategory[]>> {
  const childCategories = productSource.childCategories?.bind(productSource)
  if (childCategories === undefined) return EMPTY
  const identifiers = collectMenuCategories(content)
  if (identifiers.length === 0) return EMPTY

  const results = await Promise.allSettled(
    identifiers.map((id) => childCategories(id, { locale: locale.delivery })),
  )
  const resolved = new Map<string, readonly ChildCategory[]>()
  results.forEach((result, i) => {
    const id = identifiers[i]
    if (result.status === 'fulfilled' && id !== undefined) resolved.set(id, result.value)
  })
  return resolved
}

/** `content` with each ticked category menu item's child categories added. */
export async function addChildCategories<T>(content: T, locale: Locale): Promise<T> {
  return withChildCategories(content, await resolveChildCategories(content, locale))
}
