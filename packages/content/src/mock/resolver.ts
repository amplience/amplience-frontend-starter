/**
 * Recursively walks a content body and replaces content-link stubs with the
 * resolved body of the referenced item — the mock's equivalent of the
 * Amplience delivery API's `?depth=all` behaviour.
 *
 * Behaviour notes:
 *  - Cycles are guarded by a `visited` set keyed on content-item ID. A cycle
 *    leaves the stub in place rather than throwing — matches Amplience's
 *    "depth limit reached" behaviour and keeps a malformed fixture from
 *    bringing down the renderer.
 *  - Unresolved references (the stub references an ID not in the fixture set)
 *    leave the stub in place. The renderer will surface this when it tries
 *    to dispatch on the unfamiliar schema, per ADR-0010's loud-failure mode.
 *  - The walk is structural: arrays recurse into elements, objects recurse
 *    into their own values. Primitives are returned as-is.
 */

import type { ContentBody, EnrichedContentItem } from '../types'
import { isContentLink } from '../types'

type FindById = (id: string) => EnrichedContentItem | undefined

/**
 * Resolve all content-links inside `body`. Returns a new body with stubs
 * replaced by their referenced body (also recursively resolved).
 */
export const resolveDeep = (body: ContentBody, findById: FindById): ContentBody => {
  const walk = (value: unknown, visited: ReadonlySet<string>): unknown => {
    if (isContentLink(value)) {
      // Cycle guard — leave the stub in place rather than recurse forever.
      if (visited.has(value.id)) return value
      const ref = findById(value.id)
      if (!ref) return value // unresolved — let the renderer surface it
      const nextVisited = new Set(visited).add(value.id)
      return walk(ref.body, nextVisited)
    }
    if (Array.isArray(value)) {
      return value.map((el) => walk(el, visited))
    }
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) out[k] = walk(v, visited)
      return out
    }
    return value
  }

  return walk(body, new Set<string>()) as ContentBody
}
