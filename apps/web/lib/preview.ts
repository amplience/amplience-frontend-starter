/**
 * Schedule preview (ADR-0028) — the pure, runtime-neutral half.
 *
 * Amplience's preview app opens `/preview/{{vse.domain}}`: a virtual-staging
 * host pinned to a date (or an edition). The host rides the URL, never a
 * cookie, so a preview tab and live tabs stay independent. The middleware,
 * the server routes and the client banner all import from here, so nothing
 * in this module may touch `next/headers` or Node APIs.
 */

/** First path segment of a preview URL. */
export const PREVIEW_SEGMENT = 'preview'

/** Request header the middleware forwards the validated host on. */
export const PREVIEW_HEADER = 'x-preview-vse'

/** Amplience's Virtual Staging API — re-pins a host to another timestamp. */
export const VIRTUAL_STAGING_API = 'https://virtual-staging.amplience.net/domain'

/** The only host suffix a VSE can have — literal suffix check, no patterns. */
export const VSE_SUFFIX = '.staging.bigcontent.io'

/** Characters that would let a host escape `https://<host>/...`. */
const HOST_BREAKERS = ['/', '?', '#', '@', ':', '\\', ' ']

/** A bare VSE hostname and nothing else — the value is interpolated into URLs. */
export const isVseHost = (value: string): boolean =>
  value.length > VSE_SUFFIX.length &&
  value.length <= 253 &&
  value.endsWith(VSE_SUFFIX) &&
  HOST_BREAKERS.every((char) => !value.includes(char))

/** URL prefix for every page of a preview session. */
export const previewBasePath = (host: string): string => `/${PREVIEW_SEGMENT}/${host}`

/** Marker the Virtual Staging API puts between base and timestamp (rot13 "timestamp"). */
const TIMESTAMP_MARKER = 'gvzrfgnzc'

const DIGITS = new Set('0123456789')

/**
 * The instant a host is pinned to (epoch ms), read off `<base>-gvzrfgnzc-<ms>`.
 * Display only — the format is observed, not documented, so anything else
 * (an edition preview, the unpinned base) is simply `undefined`.
 */
export const pinnedAt = (host: string): number | undefined => {
  const label = host.split('.')[0] ?? ''
  const [base, marker, ms, ...rest] = label.split('-')
  if (base === undefined || base === '' || marker !== TIMESTAMP_MARKER || rest.length > 0) {
    return undefined
  }
  if (ms === undefined || ms === '' || ![...ms].every((char) => DIGITS.has(char))) return undefined
  return Number(ms)
}

/**
 * Split a browser pathname into the preview host and the site path under it.
 * `/preview/<host>/fr-fr/about` → `{ host, path: '/fr-fr/about' }`; anything
 * that isn't a valid preview URL → `undefined`.
 */
export const splitPreviewPath = (pathname: string): { host: string; path: string } | undefined => {
  const segments = pathname.split('/')
  if (segments[1] !== PREVIEW_SEGMENT) return undefined
  const host = segments[2] ?? ''
  if (!isVseHost(host)) return undefined
  const path = `/${segments.slice(3).join('/')}`
  return { host, path }
}
