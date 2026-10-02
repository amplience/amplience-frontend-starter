/**
 * Reconciling a fixture set's authored locales with the hub's (ADR-0019).
 *
 * Locale lists are configured per hub, so the content and the target hub are
 * almost never going to agree. The seed is the only place that knows both
 * sides, so it filters: authored locales the hub doesn't have are dropped.
 *
 * Locales the hub has but the set lacks are **left absent, never filled**.
 * Fallback already happens at delivery — `resolveLocales` builds preference
 * strings like `fr-FR,en-US,*` and `resolveLocalized` walks them — so copying
 * values in here would duplicate content on the hub to reproduce behaviour we
 * already have, and would make untranslated fields indistinguishable from
 * translated ones in the DC UI.
 *
 * Plain ESM so `node scripts/hub-import.mjs` can import it without a TS loader;
 * `locales.d.mts` gives the .ts test real types.
 */

/** A localized field is any object whose `_meta.schema` names one. */
const isLocalized = (node) =>
  node !== null &&
  typeof node === 'object' &&
  !Array.isArray(node) &&
  Array.isArray(node.values) &&
  typeof node._meta?.schema === 'string' &&
  node._meta.schema.includes('localized')

/**
 * Drop every authored locale the hub doesn't have, in place.
 *
 * @param item a parsed content item (the whole enriched envelope is fine)
 * @param hubLocales the hub's configured locales
 * @returns what happened, for reporting and for the caller's fail-loud checks
 */
export const filterLocales = (item, hubLocales) => {
  const allowed = new Set(hubLocales)
  const kept = new Set()
  const dropped = new Set()
  const emptied = []
  let changed = false

  const walk = (node, trail) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${trail}[${i}]`))
      return
    }
    if (node === null || typeof node !== 'object') return

    if (isLocalized(node)) {
      const before = node.values.length
      node.values = node.values.filter((v) => {
        // A value with no locale isn't ours to judge — leave it alone.
        if (typeof v?.locale !== 'string') return true
        if (allowed.has(v.locale)) {
          kept.add(v.locale)
          return true
        }
        dropped.add(v.locale)
        return false
      })
      if (node.values.length !== before) changed = true
      // A field with nothing left would import as an empty localized value:
      // the content is on the hub but every locale renders blank. Louder to
      // stop than to seed it.
      if (node.values.length === 0 && before > 0) emptied.push(trail)
    }

    for (const [key, value] of Object.entries(node)) walk(value, `${trail}.${key}`)
  }

  walk(item, '')
  return { changed, kept, dropped, emptied }
}

/**
 * One line describing a set's reconciliation against a hub, or undefined when
 * there is nothing to say (every authored locale survived).
 */
export const describeLocaleFilter = ({ kept, dropped }, authored) => {
  if (dropped.size === 0) return undefined
  const keptList = [...kept].sort().join(', ')
  return `kept ${kept.size} of ${authored} authored locales: ${keptList} (dropped ${[...dropped].sort().join(', ')})`
}
