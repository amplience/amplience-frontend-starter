/**
 * The identifier is the key a hub is addressed by — config entry, API route
 * segment, `active`, and the prefix of a derived Vercel project name. It's
 * internal: the GUI collects a label and derives this from it, so it only has
 * to be stable, URL-safe and unique.
 */

const MAX_LENGTH = 60

/** Lowercase, alphanumerics-and-hyphens slug; "" when the label has no letters. */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '')
}

/**
 * A slug of `label` that isn't in `taken`, suffixed `-2`, `-3`… on collision.
 * Emoji-only or empty labels fall back to "hub", which then dedupes the same
 * way.
 */
export function deriveIdentifier(label: string, taken: Iterable<string>): string {
  const base = slugifyLabel(label) || 'hub'
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
