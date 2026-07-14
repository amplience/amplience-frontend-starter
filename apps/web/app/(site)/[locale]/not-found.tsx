/**
 * Branded 404 for the localized site (QL-37; localized under ADR-0015).
 *
 * Reached when a route in this subtree calls `notFound()` — including the
 * content-fetch path, where a `ContentClientError` of kind 'not-found' means
 * the page item doesn't exist in the hub — and for any URL with no route.
 *
 * The body is editable content, not code: it fetches the `${siteName}/site/not-found`
 * slot by delivery key and renders it through the registry, exactly as the
 * layout does with the header and footer. So editors control the 404 copy —
 * and, because the fetch carries the active locale, its translations — without
 * a code deploy. A markdown block, a hero, or any mix an editor drops into the
 * slot renders here for free (the renderer recurses; this route is agnostic to
 * what the slot contains).
 *
 * Two things the layout doesn't need but this file does:
 *   - `not-found.tsx` receives no `params`, so the active locale can't be read
 *     from the segment. The middleware stashes it in the `x-locale` request
 *     header (ADR-0015); we resolve that, falling back to the default locale
 *     when it's absent (e.g. a request that never passed through the
 *     middleware).
 *   - The fetch can fail — and a 404 often fires *because* the hub is
 *     unreachable, so fetching the 404 body would fail too. Any failure falls
 *     back to the hardcoded `NotFoundContent`, which has no network dependency.
 *
 * A Server Component: no client JavaScript. It emits no `<main>` — the site
 * layout already provides the landmark around this boundary.
 */

import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { client, siteName } from '../../../lib/content-client'
import { defaultLocale, localeBasePath, localeForSlug } from '../../../lib/locales'
import { registry } from '../../../lib/registry'
import { NotFoundContent } from '../../../src/components/NotFoundContent'
import { renderContent } from '../../../src/renderer'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default async function NotFound() {
  // `not-found.tsx` gets no params; the middleware carries the resolved locale
  // in a header. Default when it's missing so the 404 always has a locale.
  const localeSlug = (await headers()).get('x-locale')
  const locale = (localeSlug != null ? localeForSlug(localeSlug) : undefined) ?? defaultLocale
  const ctx = { localeBasePath: localeBasePath(locale) }
  try {
    const slot = await client.getByKey(`${siteName}/site/not-found`, {
      depth: 'all',
      locale: locale.delivery,
    })
    return renderContent(slot, registry, ctx)
  } catch {
    // Loud-in-console failure isn't warranted here: an editor simply may not
    // have seeded the slot yet, and the branded fallback is a complete 404.
    return <NotFoundContent />
  }
}
