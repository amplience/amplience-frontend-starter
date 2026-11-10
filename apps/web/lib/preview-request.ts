/**
 * Schedule preview (ADR-0028) — the request-scoped half, server only.
 *
 * The middleware forwards a validated staging host in `x-preview-vse` for
 * `/preview/<host>/…` URLs and strips it from everything else. This module
 * reads it back once per request.
 */

import { headers } from 'next/headers'
import { cache } from 'react'

import { localeBasePath } from './locales'
import type { Locale } from './locales'
import { isVseHost, PREVIEW_HEADER, previewBasePath } from './preview'

/** This request's preview host, or `undefined` on the live site and outside a request. */
export const getPreviewHost = cache(async (): Promise<string | undefined> => {
  let value: string | null
  try {
    value = (await headers()).get(PREVIEW_HEADER)
  } catch {
    // No request scope (build, tests, module init) — always live.
    return undefined
  }
  return value !== null && isVseHost(value) ? value : undefined
})

/** `localeBasePath`, prefixed with `/preview/<host>` inside a preview. */
export const siteBasePath = async (locale: Locale): Promise<string> => {
  const host = await getPreviewHost()
  const base = localeBasePath(locale)
  return host === undefined ? base : `${previewBasePath(host)}${base}`
}
