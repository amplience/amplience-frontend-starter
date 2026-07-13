/**
 * Locale-routing middleware (ADR-0015).
 *
 * Every public path carries a locale internally: the `(site)` routes live
 * under a `[locale]` segment, and this middleware guarantees that segment is
 * always populated. Three cases, decided by a literal set-membership test on
 * the first path segment (never a runtime-compiled pattern — v1 finding #18):
 *
 *   - The first segment is a configured locale slug in canonical (lowercase)
 *     form (`/fr-fr/about`): pass it through untouched. The `[locale]` route
 *     serves it and reads the locale from the segment.
 *   - The first segment names a locale in some other casing (`/en-GB/about`):
 *     301/308-redirect to the lowercase canonical (`/en-gb/about`). Path URLs
 *     are case-sensitive, so two casings would be duplicate content — one
 *     canonical form, but any casing a user types still gets there.
 *   - Anything else (`/about`, `/`): rewrite internally to the default locale
 *     (`/en-gb/about`). The rewrite is invisible — the address bar keeps the
 *     clean URL — so every existing URL keeps working and the default locale
 *     stays unprefixed (ADR-0015 chose to *also* serve the explicit default
 *     prefix; switching to a redirect later is a single branch here).
 *
 * The matcher keeps this off everything that isn't a content page: Next
 * internals, the visualization and debug tooling routes (which sit outside
 * `(site)` and manage their own rendering), well-known probes, and any path
 * with a file extension (static assets).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { canonicalLocaleSlug, defaultLocale } from './lib/locales'

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  // Keep the raw split (not filtered): index 1 is the first segment, and the
  // array rebuilds the path verbatim (leading/trailing slashes preserved).
  const segments = pathname.split('/')
  const firstSegment = segments[1] ?? ''

  if (firstSegment !== '') {
    const canonical = canonicalLocaleSlug(firstSegment)
    if (canonical !== undefined) {
      // A configured locale. Redirect any non-canonical casing to lowercase;
      // otherwise let the `[locale]` route handle it.
      if (canonical !== firstSegment) {
        segments[1] = canonical
        const url = request.nextUrl.clone()
        url.pathname = segments.join('/')
        return NextResponse.redirect(url, 308)
      }
      return NextResponse.next()
    }
  }

  // Unprefixed — rewrite to the default locale so `[locale]` is populated.
  // The suffix is the original path (empty at the root, so `/` → `/en-gb`).
  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale.slug}${pathname === '/' ? '' : pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Run on page paths only. Excludes Next internals (`_next/*`), the
  // visualization and debug tooling routes, well-known probes, and any path
  // containing a dot (static files like `/favicon.ico`, `/robots.txt`).
  matcher: ['/((?!_next/|visualization|debug|\\.well-known|.*\\.).*)'],
}
