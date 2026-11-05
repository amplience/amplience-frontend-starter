/**
 * How many products a listing page renders (`/products`, category pages).
 *
 * The CMS catalogue is a few dozen products; a PIM sandbox can be thousands,
 * and rendering every card in one response is what turns a listing into a
 * 25-second blank page. Until listings get a pager they show the first
 * page; `list()` already returns `total` for when one lands.
 *
 * `PRODUCT_LISTING_LIMIT` overrides the default; `0` means no limit. A value
 * that isn't a non-negative integer is ignored rather than fatal — there is a
 * sane thing to do without it.
 */

const DEFAULT_LIMIT = 48

export const resolveListingLimit = (raw: string | undefined): number | undefined => {
  const value = raw?.trim()
  if (value === undefined || value === '') return DEFAULT_LIMIT
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_LIMIT
  return parsed === 0 ? undefined : parsed
}

export const listingLimit: number | undefined = resolveListingLimit(
  process.env.PRODUCT_LISTING_LIMIT,
)
