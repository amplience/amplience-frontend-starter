/**
 * Category identifiers ↔ URL segments (ADR-0024).
 *
 * Category URLs are flat and live in the catch-all: the URL path *is* the
 * identifier, matched against the derived set from
 * `ProductSource.listCategories()` **by equality**. Nothing here parses an
 * identifier to infer structure — splitting `mens-shirts` into a parent and a
 * child would be asserting a taxonomy, which is the thing ADR-0018 Decision §8
 * rules out, and it would break the first time a PIM used `cat_0042`.
 *
 * Equality also keeps the matcher safe: identifiers originate in content and
 * reach the URL matcher, so no pattern is ever compiled from one (the literal-
 * segment rule from ADR-0014, and the v1 ReDoS finding #18).
 */

/**
 * The category identifier a catch-all slug addresses, or `null` at the root.
 *
 * Joined the same way `deliveryKeyForSlug` builds its relative key, so one
 * URL has one relative form regardless of which resolver looks at it.
 */
export const categoryIdForSlug = (slug: readonly string[] | undefined): string | null => {
  const segments = slug ?? []
  return segments.length === 0 ? null : segments.join('/')
}

/**
 * A display title derived from an identifier — `mens-shirts` → `Mens Shirts`.
 *
 * Purely cosmetic, and deliberately crude: ADR-0024 §9 accepts derived,
 * unlocalised titles until an optional decoration content type lands, and an
 * editorial override page is the escape hatch for any category that deserves
 * better. Reading hierarchy into the hyphen is *not* what this does — it is
 * string formatting for humans, and nothing downstream consumes the result.
 */
export const categoryTitle = (id: string): string =>
  id
    .split(/[-/]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
