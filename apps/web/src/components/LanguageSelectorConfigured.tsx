/**
 * LanguageSelectorConfigured — the deployment's language-selector (ADR-0015).
 *
 * The library's `LanguageSelector` is config-free: it takes the locale list as
 * props so `packages/components` needn't know a deployment's locales. This
 * server component supplies that list from `lib/locales` — the single locale
 * seam — and renders the client selector. It's registered as the
 * `LANGUAGE_SELECTOR_SCHEMA` component in `apps/web/lib/registry.ts`, the same
 * deployment-override pattern as HierarchyMenuServer.
 *
 * With one locale the selector renders nothing, so a single-locale deployment
 * that places the content type sees no dead control.
 */

import { LanguageSelector } from '@amplience/quadratic-components/language-selector'

import { defaultLocale, localeLabel, locales } from '../../lib/locales'

/** The delivery body — only `label` is authored; `_meta` rides along unused. */
type LanguageSelectorStub = {
  readonly label?: string
  readonly [key: string]: unknown
}

export function LanguageSelectorConfigured({ label }: LanguageSelectorStub) {
  const selectorLocales = locales.map((locale) => ({
    slug: locale.slug,
    label: localeLabel(locale),
  }))

  return (
    <LanguageSelector
      locales={selectorLocales}
      defaultSlug={defaultLocale.slug}
      {...(typeof label === 'string' && { label })}
    />
  )
}
