/**
 * URL path ↔ delivery key mapping for the catch-all route (QL-76, QL-131).
 *
 * Delivery keys are namespaced by site (ADR-0014): a page's key is the
 * deployment's site name plus its URL path — `/about` on the `acme` site
 * serves the item keyed `acme/about`, `/docs/getting-started` the item
 * keyed `acme/docs/getting-started`. The site name identifies the frontend
 * consumer (this deployment); it never appears in the public URL, and it is
 * not the brand — theming stays on `data-brand` (ADR-0002) and plays no
 * part in addressing.
 *
 * The mapping below the prefix stays mechanical. Two cases fall out of how
 * delivery keys work in Amplience:
 *
 *  - The root path. A delivery key can't be blank, so `/` serves the site's
 *    `<site>/homepage` — 'homepage', the relative key Quadratic 1.0
 *    standardised on.
 *  - Reserved keys. Site furniture (header, footer) is keyed content too,
 *    but it isn't a page: the layout fetches it separately, and a request
 *    for its URL is a 404, not a furniture-as-page render. The reserved
 *    set below is the single place that list lives; it names keys relative
 *    to the site prefix.
 *
 * The site prefix is a literal segment compared by equality — never a
 * pattern (v1 finding #18). One consequence of the strip in
 * `pathForDeliveryKey`: a key outside this site's namespace has no path
 * here, so one deployment can't quietly serve another site's pages —
 * isolation is a property of the mapping, not an extra check.
 *
 * Because Amplience allows multiple delivery keys per item, several URLs
 * can resolve to the same content. The canonical URL stays unambiguous
 * through the existing `pageMetadataFromSchema` chain: an item with alias
 * keys sets `canonicalUrl` in its content, which overrides the
 * self-referencing default the route passes in.
 *
 * Still out of scope, by design of this seam: locale prefixes and special
 * subroutes (`/c/…`, `/d/…`) land here when they arrive. The site name
 * itself is resolved once, in `resolveContentConfig` (ADR-0003's seam) —
 * these functions just receive it.
 */

/** The site-relative delivery key the root path serves — a blank key isn't possible. */
export const HOMEPAGE_DELIVERY_KEY = 'homepage'

/**
 * Site-relative delivery keys that name site furniture rather than routable
 * pages. Requests for these paths 404; the layout fetches the items by key.
 */
export const RESERVED_DELIVERY_KEYS: ReadonlySet<string> = new Set(['header', 'footer'])

/**
 * Map a catch-all slug (Next's `params.slug` — `undefined` at the root) to
 * the delivery key it addresses on the given site, or `null` when the path
 * names no routable page (a reserved key).
 */
export const deliveryKeyForSlug = (
  site: string,
  slug: readonly string[] | undefined,
): string | null => {
  const segments = slug ?? []
  if (segments.length === 0) return `${site}/${HOMEPAGE_DELIVERY_KEY}`
  const relative = segments.join('/')
  return RESERVED_DELIVERY_KEYS.has(relative) ? null : `${site}/${relative}`
}

/**
 * The route path that serves a delivery key on the given site — `/` for the
 * homepage key, `/<relative-key>` otherwise. Feeds the self-referencing
 * canonical default in `generateMetadata`; content-set `canonicalUrl` still
 * wins over it.
 *
 * A key outside the site's namespace is a programming error — every key this
 * receives was built by `deliveryKeyForSlug` for the same site — so it
 * throws rather than inventing a path in someone else's namespace.
 */
export const pathForDeliveryKey = (site: string, key: string): string => {
  const prefix = `${site}/`
  if (!key.startsWith(prefix)) {
    throw new Error(
      `Delivery key "${key}" is outside the "${site}" site namespace — ` +
        'no URL on this deployment serves it (ADR-0014).',
    )
  }
  const relative = key.slice(prefix.length)
  return relative === HOMEPAGE_DELIVERY_KEY ? '/' : `/${relative}`
}
