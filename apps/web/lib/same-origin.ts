/**
 * The one way the middleware builds a redirect or rewrite target: a URL on the
 * request's own origin. Backslashes and slash runs are collapsed so no path can
 * read as protocol-relative (`//other.host`), and the origin is checked rather
 * than trusted. Edge-safe — no Node APIs.
 */

type WithNextUrl = { readonly nextUrl: { clone(): URL; readonly origin: string } }

export const sameOriginUrl = (request: WithNextUrl, pathname: string): URL => {
  const url = request.nextUrl.clone()
  url.pathname = pathname.replaceAll('\\', '/').replace(/\/{2,}/g, '/')
  if (url.origin !== request.nextUrl.origin) {
    throw new Error(`Refusing to route ${pathname} off ${request.nextUrl.origin}`)
  }
  return url
}
