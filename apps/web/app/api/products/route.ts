/**
 * Resolve products by SKU for callers that cannot await a port read (ADR-0027).
 *
 * The one caller today is the visualization client: it re-renders as an author
 * edits, and a client boundary cannot reach `ProductSource`. The pre-pass does
 * the same job server-side for every real page, so this endpoint exists for the
 * live-editing path alone — the pattern Quadratic v1 used for all of its PIM
 * reads.
 *
 * It exposes nothing a visitor cannot already see: the same published products
 * the PLP and PDP render, through the same adapter, with credentials staying
 * server-side. No secret, therefore, but the SKU list is capped so a crafted
 * request cannot turn one call into an unbounded catalogue read.
 */

import { defaultLocale, locales } from '../../../lib/locales'
import type { Locale } from '../../../lib/locales'
import { resolveProductsBySku } from '../../../lib/resolve-products'

/** Beyond this a request is abuse, not a carousel — the CMS caps rails far lower. */
const MAX_SKUS = 100

const localeForCode = (code: string | null): Locale =>
  locales.find((l) => l.code === code) ?? defaultLocale

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams
  const skus = (params.get('skus') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (skus.length === 0) return Response.json({ products: [] })
  if (skus.length > MAX_SKUS) {
    return Response.json(
      { error: `At most ${String(MAX_SKUS)} SKUs per request.` },
      { status: 400 },
    )
  }

  const products = await resolveProductsBySku(skus, localeForCode(params.get('locale')))
  return Response.json(
    { products: [...products.values()] },
    // Author-facing and live by nature; a cached response would show stale
    // prices moments after an edit.
    { headers: { 'cache-control': 'no-store' } },
  )
}
