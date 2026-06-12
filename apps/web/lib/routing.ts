/**
 * URL path ↔ delivery key mapping for the catch-all route (QL-76).
 *
 * The mapping is mechanical: a page's URL path *is* its delivery key —
 * `/about` serves the item keyed `about`, `/docs/getting-started` the item
 * keyed `docs/getting-started`. Two cases fall out of how delivery keys
 * work in Amplience:
 *
 *  - The root path. A delivery key can't be blank, so `/` serves
 *    `HOMEPAGE_DELIVERY_KEY` — 'homepage', the key Quadratic 1.0
 *    standardised on.
 *  - Reserved keys. Site furniture (header, footer) is keyed content too,
 *    but it isn't a page: the layout fetches it separately, and a request
 *    for its URL is a 404, not a furniture-as-page render. The reserved
 *    set below is the single place that list lives.
 *
 * Because Amplience allows multiple delivery keys per item, several URLs
 * can resolve to the same content. The canonical URL stays unambiguous
 * through the existing `pageMetadataFromSchema` chain: an item with alias
 * keys sets `canonicalUrl` in its content, which overrides the
 * self-referencing default the route passes in.
 *
 * Out of POC scope, by design of this seam: brand-prefixed keys
 * (multi-site), locale prefixes, and special subroutes (`/c/…`, `/d/…`,
 * `/blog/…`) all land here when they arrive.
 */

/** The delivery key the root path serves — a blank key isn't possible. */
export const HOMEPAGE_DELIVERY_KEY = 'homepage'

/**
 * Delivery keys that name site furniture rather than routable pages.
 * Requests for these paths 404; the layout fetches the items by key.
 */
export const RESERVED_DELIVERY_KEYS: ReadonlySet<string> = new Set(['header', 'footer'])

/**
 * Map a catch-all slug (Next's `params.slug` — `undefined` at the root) to
 * the delivery key it addresses, or `null` when the path names no routable
 * page (a reserved key).
 */
export const deliveryKeyForSlug = (slug: readonly string[] | undefined): string | null => {
  const segments = slug ?? []
  if (segments.length === 0) return HOMEPAGE_DELIVERY_KEY
  const key = segments.join('/')
  return RESERVED_DELIVERY_KEYS.has(key) ? null : key
}

/**
 * The route path that serves a delivery key — `/` for the homepage key,
 * `/<key>` otherwise. Feeds the self-referencing canonical default in
 * `generateMetadata`; content-set `canonicalUrl` still wins over it.
 */
export const pathForDeliveryKey = (key: string): string =>
  key === HOMEPAGE_DELIVERY_KEY ? '/' : `/${key}`
