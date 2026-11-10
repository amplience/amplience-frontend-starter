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
 * Every non-redirect response also carries the resolved locale slug in an
 * `x-locale` request header. Layouts and pages read the locale from their
 * `[locale]` param, but `not-found.tsx` gets no params — so the branded 404
 * reads this header to fetch its content at the right locale (ADR-0015).
 *
 * Schedule preview (ADR-0028): `/preview/<vse-host>/<path>` runs the same
 * three cases on `<path>`, then rewrites to the plain locale route with the
 * validated host forwarded in `x-preview-vse`. That header is stripped from
 * every incoming request first, so only a preview URL can ever set it.
 *
 * The matcher keeps this off everything that isn't a content page: Next
 * internals, route handlers under `/api/`, the visualization and debug tooling
 * routes (which sit outside `(site)` and manage their own rendering),
 * well-known probes, and any path with a file extension (static assets).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { canonicalLocaleSlug, defaultLocale } from './lib/locales'
import { isVseHost, PREVIEW_HEADER, PREVIEW_SEGMENT, previewBasePath } from './lib/preview'

/**
 * Route `path` (the site path, after any preview prefix) to its `[locale]`
 * page. `base` is `''` on the live site and `/preview/<host>` in a preview,
 * where it is kept on redirects and dropped from the internal rewrite.
 */
const routeLocale = (
  request: NextRequest,
  headers: Headers,
  base: string,
  path: string,
): NextResponse => {
  // Keep the raw split (not filtered): index 1 is the first segment, and the
  // array rebuilds the path verbatim (leading/trailing slashes preserved).
  const segments = path.split('/')
  const firstSegment = segments[1] ?? ''
  const url = request.nextUrl.clone()

  if (firstSegment !== '') {
    const canonical = canonicalLocaleSlug(firstSegment)
    if (canonical !== undefined) {
      // A configured locale. Redirect any non-canonical casing to lowercase
      // (the redirected request re-enters and picks up the header below);
      // otherwise let the `[locale]` route handle it, locale header attached.
      if (canonical !== firstSegment) {
        segments[1] = canonical
        url.pathname = `${base}${segments.join('/')}`
        return NextResponse.redirect(url, 308)
      }
      headers.set('x-locale', canonical)
      if (base === '') return NextResponse.next({ request: { headers } })
      url.pathname = path
      return NextResponse.rewrite(url, { request: { headers } })
    }
  }

  // Unprefixed — rewrite to the default locale so `[locale]` is populated.
  // The suffix is the original path (empty at the root, so `/` → `/en-gb`).
  headers.set('x-locale', defaultLocale.slug)
  url.pathname = `/${defaultLocale.slug}${path === '/' ? '' : path}`
  return NextResponse.rewrite(url, { request: { headers } })
}

export function middleware(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers)
  headers.delete(PREVIEW_HEADER)

  const { pathname } = request.nextUrl
  const segments = pathname.split('/')
  const host = segments[1] === PREVIEW_SEGMENT ? (segments[2] ?? '') : ''

  // Anything that isn't a valid preview URL — including `/preview` with a bad
  // host — is an ordinary content path.
  if (!isVseHost(host)) return routeLocale(request, headers, '', pathname)

  headers.set(PREVIEW_HEADER, host)
  const response = routeLocale(
    request,
    headers,
    previewBasePath(host),
    `/${segments.slice(3).join('/')}`,
  )
  // Preview URLs carry the hub's staging host: keep them out of indexes and
  // out of the Referer sent to other origins.
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export const config = {
  // Run on page paths only. Excludes Next internals (`_next/*`), route
  // handlers (`api/*` — a rewrite would land them on the content catch-all),
  // the visualization and debug tooling routes, well-known probes, and any path
  // containing a dot (static files like `/favicon.ico`, `/robots.txt`).
  // Preview URLs are matched separately: their staging host contains dots.
  matcher: ['/((?!_next/|api/|visualization|debug|\\.well-known|.*\\.).*)', '/preview/:path*'],
}
