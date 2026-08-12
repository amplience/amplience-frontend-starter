import type { Environment } from './types.js'

/**
 * Hub count at which the filter input appears. Below this, scanning the list is
 * quicker than typing, so the control would be clutter.
 */
export const FILTER_MIN_ITEMS = 4

/** Fields a query matches against — each one is visible on a collapsed card. */
const matchFields = (env: Environment): string[] => [
  env.label,
  env.name,
  env.hubName,
  env.defaultBrand,
]

/**
 * Case-insensitive substring match; a hub matches if any single field hits.
 * Uses `includes` rather than a RegExp built from the query — user-supplied
 * patterns are the ReDoS surface the v1 audit flagged.
 */
export function matchesQuery(env: Environment, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return matchFields(env).some((field) => field.toLowerCase().includes(needle))
}

/** Hubs matching `query`, in their original order. */
export function filterEnvironments(envs: Environment[], query: string): Environment[] {
  if (query.trim() === '') return envs
  return envs.filter((env) => matchesQuery(env, query))
}
