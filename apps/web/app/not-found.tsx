/**
 * Root 404 (QL-37) — the app-wide fallback boundary.
 *
 * In practice users rarely land here: the middleware rewrites every
 * unprefixed path under `[locale]`, so real traffic 404s inside the localized
 * site (`(site)/[locale]/not-found.tsx`, which carries the header/footer and
 * editable, localized content). This boundary catches only what never reaches
 * that subtree — paths outside the middleware matcher. It renders under the
 * bare root layout, so it owns its own `<main>` landmark and shows the
 * hardcoded fallback with no network or locale dependency.
 */

import type { Metadata } from 'next'

import { NotFoundContent } from '../src/components/NotFoundContent'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <main data-page>
      <NotFoundContent />
    </main>
  )
}
