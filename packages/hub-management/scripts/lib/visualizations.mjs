/**
 * Per-site visualizations for content types, injected at import time from the
 * hub's `webApps` in amplience.config.json.
 */
import { webAppLabel } from './preview-apps.mjs'

/**
 * The site that backs card thumbnails: the one flagged `thumbnail`, else the
 * first. A hand-edited config with several flags resolves to the first of them.
 */
export const thumbnailSite = (webApps) => webApps.find((site) => site.thumbnail) ?? webApps[0]

/**
 * A copy of a content-type definition with the hub's sites wired in: one
 * `Web (…)` visualization per site goes just ahead of `Web (localhost)`, and
 * the thumbnail site backs the card thumbnail and is the default visualization.
 * With no sites, the definition (and its localhost default) is left as is.
 * URLs are expected without a trailing slash.
 */
export const withWebAppVisualizations = (contentType, webApps) => {
  const data = JSON.parse(JSON.stringify(contentType))
  const thumb = thumbnailSite(webApps)
  if (thumb === undefined) return data

  const cards = ((data.settings ??= {}).cards ??= [])
  cards[0] = {
    ...cards[0],
    templatedUri: `${thumb.url}/visualization?vse={{vse.domain}}&content={{content.sys.id}}&isThumbnail=true`,
  }

  const visualizations = data.settings.visualizations
  if (Array.isArray(visualizations)) {
    for (const v of visualizations) v.default = false
    const localhostIdx = visualizations.findIndex((v) => v.label === 'Web (localhost)')
    const insertAt = localhostIdx >= 0 ? localhostIdx : visualizations.length - 1
    visualizations.splice(
      insertAt,
      0,
      ...webApps.map((site) => ({
        label: webAppLabel(site),
        templatedUri: `${site.url}/visualization?vse={{vse.domain}}&content={{content.sys.id}}`,
        default: site === thumb,
      })),
    )
  }
  return data
}
