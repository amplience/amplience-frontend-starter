/**
 * Reading commercetools `LocalizedString`s with the deployment's locale
 * preference list.
 *
 * The routes hand every source the Delivery API's locale list
 * (`en-GB,*` — see `apps/web/lib/locales.ts`), because that is what the CMS
 * speaks. commercetools keys values by IETF tag too, but a project commonly
 * holds language-only keys (`en`, `de`) — the commercetools sample data and
 * the AnyaFinn import both do. So each preference is tried exactly, then by
 * its language, then against any regional variant of that language, before
 * moving on; `*` takes whatever value exists, the same meaning it has in the
 * delivery locale grammar.
 */

import type { LocalizedString } from './wire'

/** `"en-GB,de-DE,*"` → `['en-GB', 'de-DE', '*']`; unset → `['*']`. */
export const localePreferences = (locale: string | undefined): readonly string[] => {
  const prefs = (locale ?? '')
    .split(',')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return prefs.length > 0 ? prefs : ['*']
}

const languageOf = (tag: string): string => tag.split('-')[0]?.toLowerCase() ?? tag

/** The value for the first preference that has one, or `undefined`. */
export const pickLocalized = (
  value: LocalizedString | undefined,
  prefs: readonly string[],
): string | undefined => {
  if (value === undefined) return undefined
  const keys = Object.keys(value)
  if (keys.length === 0) return undefined

  for (const pref of prefs) {
    if (pref === '*') return Object.values(value)[0]

    const exact = value[pref]
    if (exact !== undefined) return exact

    const language = languageOf(pref)
    const sameLanguage =
      keys.find((k) => k.toLowerCase() === language) ?? keys.find((k) => languageOf(k) === language)
    if (sameLanguage !== undefined) return value[sameLanguage]
  }
  return undefined
}

/**
 * True for a plain `{ tag: string }` object — the shape of an `ltext`
 * attribute value, as opposed to an enum's `{ key, label }`.
 */
export const isLocalizedString = (value: unknown): value is LocalizedString => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return (
    entries.length > 0 &&
    !('key' in value) &&
    entries.every(([k, v]) => typeof v === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(k))
  )
}
