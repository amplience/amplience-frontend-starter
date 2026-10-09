/**
 * How the Workforce setup panel names an organization (ADR-0023).
 *
 * An organization's label can only be read with a personal access token, which
 * is the very thing the panel exists to obtain — so the first time anyone sees
 * it there may be nothing but an opaque `org_…` id. Naming it by the hubs it
 * covers is both friendlier and more useful than showing that id, since what
 * the operator actually wants to know is what one token saves them repeating.
 */

/** "A", "A and B", "A, B and C". */
export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`
}

export type CoverageInput = {
  /** The organization's own label, once a token has let us read it. */
  label?: string
  /** Labels of saved hubs already known to be in this organization. */
  hubs: string[]
  /** The hub being set up, which may not be saved yet — so not in `hubs`. */
  currentHubLabel?: string
}

/**
 * One sentence saying what setting a token up here buys. The organization id is
 * deliberately not in it: it is shown separately, as detail rather than as the
 * name of the thing.
 */
export function coverageSentence({ label, hubs, currentHubLabel }: CoverageInput): string {
  const subject =
    label === undefined || label === '' ? 'Setting it up' : `Setting it up for ${label}`

  if (hubs.length > 0) {
    const count = hubs.length === 1 ? 'this hub' : `these ${String(hubs.length)} hubs`
    return `${subject} covers ${count}: ${listPhrase(hubs)}.`
  }
  if (currentHubLabel !== undefined && currentHubLabel !== '') {
    return `${subject} covers ${currentHubLabel} and every other hub you add to the same organization.`
  }
  return `${subject} covers every hub in this organization.`
}
