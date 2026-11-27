import type { WebApp } from './types.js'

/** A copy of `list` with the item at `from` moved to `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  if (moved === undefined || to < 0 || to > next.length) return [...list]
  next.splice(to, 0, moved)
  return next
}

/**
 * Index of the hub's thumbnail site — card thumbnails and the default
 * visualization: the flagged site, else the first (-1 with no sites).
 * Mirrors `thumbnailSite` in hub-management's visualizations.mjs.
 */
export function thumbnailIndex(webApps: readonly WebApp[]): number {
  const flagged = webApps.findIndex((site) => site.thumbnail)
  return flagged === -1 && webApps.length > 0 ? 0 : flagged
}

/** The site without its thumbnail flag. */
export function withoutThumbnail(site: WebApp): WebApp {
  const { thumbnail: _thumbnail, ...rest } = site
  return rest
}

/** Sites with the one at `index` replaced; a flagged replacement takes the flag from the rest. */
export function replaceSite(webApps: readonly WebApp[], index: number, site: WebApp): WebApp[] {
  return webApps.map((s, i) => (i === index ? site : site.thumbnail ? withoutThumbnail(s) : s))
}
