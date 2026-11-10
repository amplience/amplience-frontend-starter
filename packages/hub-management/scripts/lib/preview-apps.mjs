/**
 * Schedule-preview applications (ADR-0028) for the hub settings step.
 *
 * Amplience's Preview opens a hub-level "application" — `{ name, templatedUri }`
 * in hub settings — with `{{vse.domain}}` pinned to the date or edition being
 * previewed. One per web app, named like the visualizations so editors see the
 * same `Web (…)` labels in both places.
 */

/** Label for a web app — `Web (staging)`, or plain `Web` when unlabelled. */
export const webAppLabel = (site) => (site.label ? `Web (${site.label})` : 'Web')

/** The preview entry URL for a deployment. */
export const previewTemplate = (url) => `${url}/preview/{{vse.domain}}`

/**
 * The applications this repo owns: `Web (localhost)` first, then one per web
 * app. URLs are expected without a trailing slash.
 */
export const previewApplications = ({ localhostUrl, webApps }) => [
  { name: 'Web (localhost)', templatedUri: previewTemplate(localhostUrl) },
  ...webApps.map((site) => ({ name: webAppLabel(site), templatedUri: previewTemplate(site.url) })),
]

/**
 * A copy of a settings definition with our applications merged in by name —
 * ours replace same-named entries, anything else already listed is kept.
 */
export const withPreviewApplications = (settingsJson, applications) => {
  const ours = new Set(applications.map((app) => app.name))
  const existing = settingsJson.settings?.applications ?? []
  return {
    ...settingsJson,
    settings: {
      ...settingsJson.settings,
      applications: [...applications, ...existing.filter((app) => !ours.has(app.name))],
    },
  }
}

/** Names from `expected` missing on the hub — dc-cli can drop them silently. */
export const missingApplications = (expected, hubApplications) => {
  const present = new Set((hubApplications ?? []).map((app) => app.name))
  return expected.filter((app) => !present.has(app.name)).map((app) => app.name)
}
