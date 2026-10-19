/** Deep links into Dynamic Content for the Workforce setup step (ADR-0023). */

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
