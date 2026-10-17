/**
 * Fill the holes the live visualization model has where a localized field has
 * no value in the pane's locale.
 *
 * Why this exists: `dc-visualization-sdk`'s `form.changed` hands us the form
 * already converted to delivery format by the Amplience host, and the host
 * collapses every localized field to the locale selected in the pane, with
 * no fallback chain. A field authored only in another locale arrives as
 * `null` (title: null, ctas[].label: null…), and the component validators
 * reject it. The SDK has no option to ask for the raw `{ values }` objects, so
 * `resolveLocalized` can't help — by the time we see the model, the other
 * locales are already gone.
 *
 * The server render doesn't have this problem: it fetches with the delivery
 * locale list (`<code>,<default>,*`) and gets the fallback value. So when a live
 * value is `null` and the server model has a value at the same place, keep
 * the server's value — the same thing the Delivery API would have returned.
 *
 * "The same place": nested content items are matched by `_meta.deliveryId`
 * (so reordering components in a slot still lines up); inside an item,
 * object keys by name and array elements by index.
 *
 * Known trade-offs (editor tooling, not the public site):
 *  - Clearing a localized field in the form shows its last-saved fallback
 *    value until save, rather than an empty field.
 *  - A component newly added in the form isn't in the server model, so its
 *    other-locale fields stay `null` until the item is saved and the pane
 *    re-renders.
 */

type Json = unknown

const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const deliveryIdOf = (value: Json): string | undefined => {
  if (!isObject(value)) return undefined
  const meta = value._meta
  if (!isObject(meta)) return undefined
  return typeof meta.deliveryId === 'string' ? meta.deliveryId : undefined
}

/** Every content item in `model`, by delivery id. */
const indexByDeliveryId = (model: Json): ReadonlyMap<string, Json> => {
  const index = new Map<string, Json>()
  const visit = (value: Json): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isObject(value)) return
    const id = deliveryIdOf(value)
    if (id !== undefined && !index.has(id)) index.set(id, value)
    Object.values(value).forEach(visit)
  }
  visit(model)
  return index
}

export const fillLocaleGaps = (live: Json, fallback: Json): Json => {
  const byId = indexByDeliveryId(fallback)

  const walk = (value: Json, reference: Json): Json => {
    if (value === null) return reference ?? null
    if (Array.isArray(value)) {
      const refArray = Array.isArray(reference) ? reference : []
      return value.map((element, i) => walk(element, refArray[i]))
    }
    if (isObject(value)) {
      // A nested content item re-anchors on its own saved counterpart.
      const id = deliveryIdOf(value)
      const ref = id !== undefined ? byId.get(id) : isObject(reference) ? reference : undefined
      const refObject = isObject(ref) ? ref : {}
      const out: Record<string, Json> = {}
      for (const [key, child] of Object.entries(value)) out[key] = walk(child, refObject[key])
      return out
    }
    return value
  }

  return walk(live, fallback)
}
