/** Deep links into Dynamic Content — the Workforce setup step (ADR-0023) and content items. */

const DC_APP = 'https://app.amplience.net/content/#!'

/**
 * The hub's **Development → Personal Access Tokens** screen.
 *
 * The route is keyed by hub name even though tokens are scoped to the
 * organization, so any hub in that organization lands on the same list —
 * whichever one is to hand will do.
 *
 * Undefined when there is no hub name yet, so the panel names the screen in
 * words rather than offering a link that goes nowhere.
 */
export function personalAccessTokensUrl(hubName: string | undefined): string | undefined {
  if (hubName === undefined || hubName.trim() === '') return undefined
  return `${DC_APP}/${encodeURIComponent(hubName.trim())}/development/personal-access-tokens`
}

/** A content item in the DC editor, or undefined when there is no hub name to route by. */
export function contentItemUrl(hubName: string | undefined, itemId: string): string | undefined {
  if (hubName === undefined || hubName.trim() === '') return undefined
  return `${DC_APP}/${encodeURIComponent(hubName.trim())}/authoring/content-item/edit/${encodeURIComponent(itemId)}`
}

/** A content type's short name from its schema URI — `…/hero-banner.json` → `hero-banner`. */
export function schemaShortName(schema: string | undefined): string | undefined {
  if (schema === undefined || schema === '') return undefined
  const name = schema
    .replace(/\.json$/, '')
    .split('/')
    .pop()
  return name === '' ? undefined : name
}
