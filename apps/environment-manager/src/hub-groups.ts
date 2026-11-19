import type { Environment } from './types.js'

export type HubSection = {
  /** Display name; null for hubs with no group. */
  group: string | null
  hubs: Environment[]
}

/** Trimmed group name, or undefined when blank. */
export const groupOf = (env: Environment): string | undefined => {
  const group = env.group?.trim()
  return group === undefined || group === '' ? undefined : group
}

/**
 * Sections for the hub list: groups in order of first appearance, then ungrouped
 * hubs last. With no groups at all, a single null section — the flat list.
 */
export function groupHubs(envs: Environment[]): HubSection[] {
  const named = new Map<string, Environment[]>()
  const ungrouped: Environment[] = []
  for (const env of envs) {
    const group = groupOf(env)
    if (group === undefined) ungrouped.push(env)
    else named.set(group, [...(named.get(group) ?? []), env])
  }
  const sections: HubSection[] = [...named].map(([group, hubs]) => ({ group, hubs }))
  if (ungrouped.length > 0) sections.push({ group: null, hubs: ungrouped })
  return named.size === 0 ? [{ group: null, hubs: ungrouped }] : sections
}

/** Distinct group names in use, in order of first appearance. */
export const groupNames = (envs: Environment[]): string[] =>
  groupHubs(envs).flatMap((s) => (s.group === null ? [] : [s.group]))

/**
 * Snaps a typed group to an existing one that differs only by case, so
 * "prospects" joins "Prospects" instead of starting a second group.
 */
export function canonicalGroup(input: string, existing: string[]): string {
  const typed = input.trim()
  return existing.find((g) => g.toLowerCase() === typed.toLowerCase()) ?? typed
}

/**
 * New hub order after moving `from` onto `to`'s position within one section.
 * The section's hubs keep the array slots they already occupy, so other
 * sections are untouched. Returns the input order when the move is invalid.
 */
export function reorderWithin(names: string[], section: string[], from: string, to: string) {
  const fromIdx = section.indexOf(from)
  const toIdx = section.indexOf(to)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return names
  const moved = [...section]
  moved.splice(fromIdx, 1)
  moved.splice(toIdx, 0, from)
  const slots = new Set(section)
  let next = 0
  return names.map((name) => (slots.has(name) ? (moved[next++] ?? name) : name))
}
