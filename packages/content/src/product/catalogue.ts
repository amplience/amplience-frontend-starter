/**
 * Product catalogue assembly — the shared derivation behind every
 * `CmsProductSource` read.
 *
 * `listBySchema(PRODUCT_SCHEMA)` answers hub-wide, and a hub holds more than
 * one site's content. Two properties fall out of narrowing it here, once:
 *
 *   Site scoping. The product schema is shared hub-wide; the
 *   `<site>/products/` delivery-key namespace is not (ADR-0014). Under
 *   ADR-0019 a single hub can carry several fixture sets side by side, so
 *   another set's products will genuinely come back from the same read —
 *   this is correctness, not defensive tidying. The prefix comparison has to
 *   be on `<site>/products/` in full, or a site named `acme` would swallow
 *   `acme-outlet`'s catalogue.
 *
 *   One product per slug. Only one item can answer at `/products/<slug>`.
 *   The Filter API reads the *published* index, which can hold more than one
 *   item claiming a slug — an item archived in the CMS keeps its published
 *   snapshot, and its delivery key with it, until explicitly unpublished. A
 *   hub seeded and torn down several times therefore answers with one copy
 *   per cycle. `duplicateSlugs` reports them so it shows up in logs rather
 *   than as a grid of repeats.
 *
 * Deliberately a mirror of `apps/web/lib/blog-archive.ts` rather than an
 * import of it: the two share a shape, not a dependency, and blog's version
 * sorts on `publishDate`, which products do not have.
 */

/** One catalogue item, paired with the slug its public URL uses. */
export type CatalogueEntry<T> = {
  readonly item: T
  readonly slug: string
}

export type Catalogue<T> = {
  /** Stable order, one entry per slug. */
  readonly entries: readonly CatalogueEntry<T>[]
  /** Slugs more than one published item claimed — empty in a healthy hub. */
  readonly duplicateSlugs: readonly string[]
}

type WithMeta = { readonly _meta?: unknown }

/** Extract the first delivery key value from the standard `_meta` shape. */
export const deliveryKeyFromMeta = (meta: unknown): string | undefined => {
  const m = meta as { deliveryKeys?: { values?: { value: string }[] } } | undefined
  return m?.deliveryKeys?.values?.[0]?.value
}

const deliveryIdFromMeta = (meta: unknown): string => {
  const m = meta as { deliveryId?: string } | undefined
  return m?.deliveryId ?? ''
}

const nameOf = (item: WithMeta): string => {
  const withName = item as { name?: unknown }
  return typeof withName.name === 'string' ? withName.name : ''
}

/**
 * Turn a schema-wide read into one site's catalogue.
 *
 * Ordering is by product name, then delivery id. Products have no
 * `publishDate` to sort on and no authored sequence, so name is the only
 * ordering an editor can predict. The id tiebreak only decides duplicate
 * claims on a slug — which copy wins is immaterial, but it must be the *same*
 * copy on every render, or a listing and a prerendered detail page can
 * disagree between builds.
 */
export const catalogueFromItems = <T extends WithMeta>(
  items: readonly T[],
  siteName: string,
): Catalogue<T> => {
  const prefix = `${siteName}/products/`

  const scoped = items
    .flatMap((item) => {
      const key = deliveryKeyFromMeta(item._meta)
      if (!key?.startsWith(prefix)) return []
      return [{ item, slug: key.slice(prefix.length) }]
    })
    .sort((a, b) => {
      const byName = nameOf(a.item).localeCompare(nameOf(b.item))
      if (byName !== 0) return byName
      return deliveryIdFromMeta(a.item._meta).localeCompare(deliveryIdFromMeta(b.item._meta))
    })

  const entries: CatalogueEntry<T>[] = []
  const duplicateSlugs: string[] = []
  const seen = new Set<string>()
  for (const entry of scoped) {
    if (seen.has(entry.slug)) {
      if (!duplicateSlugs.includes(entry.slug)) duplicateSlugs.push(entry.slug)
      continue
    }
    seen.add(entry.slug)
    entries.push(entry)
  }

  return { entries, duplicateSlugs }
}

// `console` via globalThis — this package compiles without DOM/node types.
const globals = globalThis as { console?: { warn?: (message: string) => void } }

/**
 * Log a duplicate-slug finding once per read. The catalogue still renders
 * correctly when this fires, so it is a warning rather than a failure card —
 * but published content outliving its CMS lifecycle only ever accumulates.
 */
export const warnOnDuplicateSlugs = (duplicateSlugs: readonly string[]): void => {
  if (duplicateSlugs.length === 0) return
  globals.console?.warn?.(
    `[products] More than one published item claims ${duplicateSlugs.length} product ` +
      `slug(s): ${duplicateSlugs.join(', ')}. Name-then-stable-id wins. This means ` +
      'archived items still hold published snapshots — run hub:wipe, which ' +
      'unpublishes before archiving, to retract them.',
  )
}
