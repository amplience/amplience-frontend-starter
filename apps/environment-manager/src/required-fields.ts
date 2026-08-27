import type { Environment } from './types.js'

/**
 * Only string-valued keys — excludes boolean fields (republish,
 * ignoreSchemaValidation) and array fields (webApps). The `-?` strips optional
 * modifiers so optional fields don't leak `undefined` into the key union.
 */
export type StringEnvKey = {
  [K in keyof Environment]-?: Environment[K] extends string ? K : never
}[keyof Environment]

/**
 * Fields a hub can't be saved without, in the order the form renders them.
 * `name` is absent by design: the identifier is derived from the label on the
 * server, so the form never collects one.
 */
export const REQUIRED_FIELDS = [
  'label',
  'clientId',
  'clientSecret',
  'hubName',
  'hubId',
  'repoContent',
  'repoSlots',
  'localhostUrl',
] as const satisfies readonly StringEnvKey[]

export type RequiredField = (typeof REQUIRED_FIELDS)[number]

/** Whether a field carries the required marker (and the submit-time check). */
export function isRequired(key: string): key is RequiredField {
  return (REQUIRED_FIELDS as readonly string[]).includes(key)
}

/** Required fields left blank, in form order — empty means the form can save. */
export function missingRequired(env: Partial<Environment>): RequiredField[] {
  return REQUIRED_FIELDS.filter((key) => (env[key] ?? '').trim() === '')
}
