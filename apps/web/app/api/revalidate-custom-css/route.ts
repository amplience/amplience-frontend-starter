/**
 * On-demand revalidation for the CMS custom CSS.
 *
 * The custom-CSS read is cached with `unstable_cache` under the
 * `CUSTOM_CSS_TAG` tag (see ../../../lib/custom-css), with a time-based
 * revalidate window as the backstop. That window means a published edit can
 * take up to the window to appear in production. This endpoint lets Amplience
 * (a webhook on the custom-CSS content type's publish event) clear the tag
 * immediately, so edits show on the next request instead of waiting it out.
 *
 * It only clears *our* Next cache; Amplience's own published-CDN edition
 * updates on publish independently. Authorised by a shared secret
 * (`AMPLIENCE_REVALIDATE_SECRET`) sent as the `x-revalidate-secret` header or a
 * `?secret=` query param, compared in constant time. When the secret isn't
 * configured the endpoint is inert (501) rather than open. HMAC verification
 * of the Amplience webhook signature is a reasonable hardening follow-up.
 */

import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'

import { CUSTOM_CSS_TAG } from '../../../lib/custom-css'

const SECRET = process.env.AMPLIENCE_REVALIDATE_SECRET

/** The caller's presented secret, from header or query. */
function presentedSecret(req: Request): string {
  return req.headers.get('x-revalidate-secret') ?? new URL(req.url).searchParams.get('secret') ?? ''
}

/** Constant-time comparison; false unless a secret is configured and matches. */
function secretMatches(presented: string): boolean {
  if (!SECRET) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function POST(req: Request): Response {
  if (!SECRET) {
    return Response.json(
      { revalidated: false, reason: 'AMPLIENCE_REVALIDATE_SECRET is not configured' },
      { status: 501 },
    )
  }
  if (!secretMatches(presentedSecret(req))) {
    return Response.json({ revalidated: false, reason: 'unauthorised' }, { status: 401 })
  }
  // Next 16: revalidateTag requires a cache profile. 'max' marks the tag stale
  // with stale-while-revalidate semantics — the next request refetches in the
  // background, which is the right behaviour for a publish webhook.
  revalidateTag(CUSTOM_CSS_TAG, 'max')
  return Response.json({ revalidated: true, tag: CUSTOM_CSS_TAG, now: Date.now() })
}
