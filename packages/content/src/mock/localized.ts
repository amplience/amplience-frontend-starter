/**
 * Collapses field-level localized values to a single value — the mock's
 * equivalent of what the Amplience Delivery API does when a request carries a
 * `locale` (ADR-0015). Without this the mock would hand the renderer the raw
 * `{ values: [...] }` object, which no component can consume.
 *
 * The `locale` argument is the same delivery-locale string sent to the real
 * API: a comma-separated preference list, e.g. `fr-FR,en-US,*`. Resolution
 * walks the list in order — an exact locale match wins, `*` takes the first
 * available value — mirroring Amplience's locale-group fallback. A field with
 * no matching locale and no wildcard resolves to `undefined` (the field drops,
 * as it would from the real API); in practice the app always terminates the
 * list with `*`, so a value is always produced.
 *
 * The walk is structural (arrays into elements, objects into their values),
 * so localized values resolve wherever they sit in the tree. It runs after
 * content-link resolution (`resolveDeep`), so inlined references are localized
 * too.
 */

import type { ContentBody } from '../types'
import { isLocalizedValue } from '../types'

const parsePreferences = (locale: string): readonly string[] =>
  locale
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '')

/** Pick the value for the first preference that matches; `*` = first value. */
const pick = (
  values: readonly { readonly locale: string; readonly value: unknown }[],
  preferences: readonly string[],
): unknown => {
  for (const preference of preferences) {
    if (preference === '*') return values[0]?.value
    const match = values.find((v) => v.locale === preference)
    if (match !== undefined) return match.value
  }
  return undefined
}

/**
 * Resolve every localized value in `body` against the delivery-locale list.
 * Returns a new body with each `{ values, _meta }` replaced by its single
 * resolved value.
 */
export const resolveLocalized = (body: ContentBody, locale: string): ContentBody => {
  const preferences = parsePreferences(locale)

  const walk = (value: unknown): unknown => {
    if (isLocalizedValue(value)) {
      // The picked value can itself contain localized values (localized
      // objects), so walk the result too.
      return walk(pick(value.values, preferences))
    }
    if (Array.isArray(value)) return value.map(walk)
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) out[k] = walk(v)
      return out
    }
    return value
  }

  return walk(body) as ContentBody
}
