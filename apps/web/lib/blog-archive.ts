/**
 * Blog archive assembly — the shared step between `/blog` and `/blog/[slug]`.
 *
 * Both routes start from the same `listBySchema(BLOG_ARTICLE_SCHEMA)` read and
 * need the same thing from it: the articles that belong to *this* site, keyed
 * by the slug their URL uses. The archive page renders them; the article page
 * enumerates their slugs for `generateStaticParams`. Deriving that once here
 * keeps the two routes from drifting — a slug the archive links to and a slug
 * the router prerenders should never disagree.
 *
 * Two properties fall out of doing it in one pure function:
 *
 *   Site scoping. The blog-article schema is shared hub-wide; the
 *   `<site>/blog/` delivery-key namespace is not (ADR-0014). Articles on
 *   another site of the same hub, and articles of the same type published
 *   outside the blog route, stay out.
 *
 *   One card per slug. Only one item can answer at `/blog/<slug>`, so the
 *   archive shows one entry for it. That is not merely cosmetic: the Filter API
 *   reads the *published* index, which can hold more than one item claiming a
 *   slug — an item archived in the CMS keeps its published snapshot, and its
 *   delivery key with it, until it is explicitly unpublished. A hub whose seed
 *   has been torn down and rebuilt several times therefore answers with one
 *   copy per cycle. `duplicateSlugs` reports them so the condition is visible
 *   in server logs rather than silently rendering as a wall of repeats.
 */

/** One article, paired with the slug its public URL uses. */
export type BlogArchiveEntry<T> = {
  readonly article: T
  readonly slug: string
}

export type BlogArchive<T> = {
  /** Newest first, one entry per slug. */
  readonly entries: readonly BlogArchiveEntry<T>[]
  /** Slugs more than one published item claimed — empty in a healthy hub. */
  readonly duplicateSlugs: readonly string[]
}

/** The `_meta` fields this module reads; everything else is the caller's. */
type WithMeta = {
  readonly _meta?: unknown
}

/** Extract the first delivery key value from the standard `_meta` shape. */
export const deliveryKeyFromMeta = (meta: unknown): string | undefined => {
  const m = meta as { deliveryKeys?: { values?: { value: string }[] } } | undefined
  return m?.deliveryKeys?.values?.[0]?.value
}

/** Extract the delivery UUID from the standard `_meta` shape. */
const deliveryIdFromMeta = (meta: unknown): string => {
  const m = meta as { deliveryId?: string } | undefined
  return m?.deliveryId ?? ''
}

/** Read `publishDate` off an item without constraining the caller's type. */
const publishDateOf = (item: WithMeta): string => {
  const withDate = item as { publishDate?: unknown }
  return typeof withDate.publishDate === 'string' ? withDate.publishDate : ''
}

/**
 * Turn a schema-wide read into this site's archive: newest first, one entry
 * per slug.
 *
 * Ordering is `publishDate` descending, then delivery id ascending. The second
 * key only decides ties, which in practice means duplicate claims on one slug —
 * copies of the same article, so which one wins is immaterial, but it has to be
 * the *same* one on every render or the prerendered pages and the archive drift
 * apart between builds. A stable id comparison gives that; wall-clock or
 * response order would not.
 */
export const blogArchiveFromItems = <T extends WithMeta>(
  items: readonly T[],
  siteName: string,
): BlogArchive<T> => {
  const blogPrefix = `${siteName}/blog/`

  const scoped = items
    .flatMap((article) => {
      const key = deliveryKeyFromMeta(article._meta)
      if (!key?.startsWith(blogPrefix)) return []
      return [{ article, slug: key.slice(blogPrefix.length) }]
    })
    .sort((a, b) => {
      const byDate = publishDateOf(b.article).localeCompare(publishDateOf(a.article))
      if (byDate !== 0) return byDate
      return deliveryIdFromMeta(a.article._meta).localeCompare(deliveryIdFromMeta(b.article._meta))
    })

  const entries: BlogArchiveEntry<T>[] = []
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

/**
 * Log a duplicate-slug finding once per render.
 *
 * The archive still renders correctly when this fires, so it is a warning, not
 * a failure card — but it means published content is outliving its CMS
 * lifecycle, which only ever grows, so it should not pass unnoticed.
 */
export const warnOnDuplicateSlugs = (duplicateSlugs: readonly string[]): void => {
  if (duplicateSlugs.length === 0) return
  console.warn(
    `[blog] More than one published item claims ${duplicateSlugs.length} blog ` +
      `slug(s): ${duplicateSlugs.join(', ')}. Newest-then-stable-id wins. This ` +
      'means archived items still hold published snapshots — run hub:wipe, ' +
      'which unpublishes before archiving, to retract them.',
  )
}
