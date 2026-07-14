import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { LanguageSelector, type LanguageSelectorProps } from './LanguageSelector'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const LANGUAGE_SELECTOR_SCHEMA =
  'https://quadratic.amplience.com/v2/content/language-selector'

/** The language-selector delivery body — an optional label plus the envelope. */
export type LanguageSelectorSchema = {
  readonly _meta: unknown
  readonly label?: string
}

/**
 * Validator: `label` is the only authorable field and it's optional, so the
 * only invalid shape is a `label` that exists but isn't a string.
 */
export const validateLanguageSelectorSchema = (
  schema: unknown,
): schema is LanguageSelectorSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  const s = schema as { label?: unknown }
  return s.label === undefined || typeof s.label === 'string'
}

/**
 * Library default registry entry for the language-selector schema.
 *
 * The locale list is deployment config (ADR-0015), which the library can't
 * know, so this default entry renders the selector with an empty list — it
 * shows nothing. A deployment that serves multiple locales overrides this
 * entry with one that supplies the list (see `apps/web/lib/registry.ts`),
 * exactly as HierarchyMenu is overridden. This keeps the schema dispatchable
 * everywhere (visualization, Storybook) rather than surfacing as an unknown
 * type, while staying inert until composed with real config.
 */
export const languageSelectorRegistryEntry: ComponentRegistryEntry<
  LanguageSelectorSchema,
  LanguageSelectorProps
> = {
  component: LanguageSelector,
  propsFromSchema: ({ _meta: _envelope, ...props }) => ({ locales: [], defaultSlug: '', ...props }),
  validate: validateLanguageSelectorSchema,
}
