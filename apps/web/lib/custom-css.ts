/**
 * Optional CMS-managed custom CSS (Site Components repo).
 *
 * Off by default: the feature only runs when AMPLIENCE_CUSTOM_CSS is explicitly
 * "TRUE" (case-insensitive; "1" also accepted). When off, `getCustomCss` returns
 * null without touching the CMS, so the deployment stays pure-static and pays
 * nothing — matching the "core config lives in code" default. When on, the CSS
 * is fetched by delivery key and injected site-wide (see app/layout.tsx).
 *
 * The delivery SDK uses axios, which Next's fetch cache does not intercept, so
 * the read is wrapped in `unstable_cache` to give it ISR semantics (a shared,
 * time-revalidated cache with a bustable tag) rather than re-fetching per render.
 * A miss or delivery error degrades to null — an absent/blank item simply
 * injects nothing, never an error.
 */

import { unstable_cache } from 'next/cache'

import { client, siteName } from './content-client'
import { sanitizeCustomCss } from './custom-css-schema'

/** Cache tag for on-demand revalidation (e.g. from an Amplience webhook). */
export const CUSTOM_CSS_TAG = 'amplience-custom-css'

const ENABLED = /^(true|1)$/i.test((process.env.AMPLIENCE_CUSTOM_CSS ?? '').trim())

const DEV = process.env.NODE_ENV === 'development'

/** ISR window in seconds; override with AMPLIENCE_CUSTOM_CSS_REVALIDATE. */
const REVALIDATE = Number.parseInt(process.env.AMPLIENCE_CUSTOM_CSS_REVALIDATE ?? '', 10) || 300

const DELIVERY_KEY = `${siteName}/site/custom-css`

async function fetchCustomCssUncached(): Promise<string> {
  try {
    const item = await client.getByKey<{ css?: string }>(DELIVERY_KEY)
    return (item.css ?? '').trim()
  } catch {
    // not-found / delivery error → treat as "no custom CSS" (graceful degradation).
    return ''
  }
}

const fetchCustomCssCached = unstable_cache(
  fetchCustomCssUncached,
  ['amplience-custom-css', DELIVERY_KEY],
  {
    revalidate: REVALIDATE,
    tags: [CUSTOM_CSS_TAG],
  },
)

/**
 * The site-wide custom CSS to inject, or null when the feature is off or there
 * is nothing to inject. Null (not an empty string) so the caller can skip
 * rendering the <style> element entirely.
 *
 * In development the ISR cache is bypassed so edits/publishes show immediately;
 * production reads through `unstable_cache` for the revalidate window.
 */
export async function getCustomCss(): Promise<string | null> {
  if (!ENABLED) return null
  const css = DEV ? await fetchCustomCssUncached() : await fetchCustomCssCached()
  return css === '' ? null : sanitizeCustomCss(css)
}
