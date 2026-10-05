/**
 * Price selection — pick one price from a set, given a currency.
 *
 * Small enough to inline, kept separate because it encodes one rule that is
 * easy to get wrong in a way nobody notices until a customer does:
 *
 *   **Never substitute another currency.** A product with no GBP price shows
 *   no price at all, not its EUR one. Showing €899 to someone who asked for
 *   pounds is a commercial hazard, not a graceful degradation — they will
 *   read it as the number they are being charged.
 *
 * Shared by `mapProduct` (CMS selection, client-side) and available to any
 * adapter whose source hands back a set rather than selecting for it. A source
 * that selects server-side — commercetools, given price-selection parameters —
 * never calls this.
 */

import type { CurrencyCode, ProductPrice } from '../product-types'

/**
 * The price matching `currency`, or `undefined`.
 *
 * With no currency requested, the first price is returned: a single-currency
 * catalogue — which is most of them — should not have to configure anything
 * to show its one price. That is a convenience for the common case, not a
 * fallback: once a currency *is* asked for, a miss is a miss.
 */
export const selectPrice = (
  prices: readonly ProductPrice[] | undefined,
  currency?: CurrencyCode,
): ProductPrice | undefined => {
  if (prices === undefined || prices.length === 0) return undefined
  if (currency === undefined) return prices[0]
  return prices.find((p) => p.currencyCode === currency)
}

// `process` and `console` via globalThis — this package compiles without
// node or DOM types (see config.ts).
type Globals = {
  process?: { env?: Record<string, string | undefined> }
  console?: { warn?: (message: string) => void }
}
const globals = globalThis as Globals

/**
 * Warn when a product has prices but none in the requested currency.
 *
 * Dev-loud, production-quiet, like the other content diagnostics here. The
 * page renders correctly without a price — but a catalogue that is missing
 * one currency is an authoring gap someone can fix, and it is invisible
 * otherwise, because "no price" and "no price *in this currency*" look
 * identical on the page.
 */
export const warnOnMissingCurrency = (
  slug: string,
  currency: CurrencyCode | undefined,
  prices: readonly ProductPrice[] | undefined,
): void => {
  if (currency === undefined) return
  if (prices === undefined || prices.length === 0) return
  if (prices.some((p) => p.currencyCode === currency)) return
  if (globals.process?.env?.NODE_ENV === 'production') return

  const held = prices.map((p) => p.currencyCode).join(', ')
  globals.console?.warn?.(
    `[products] "${slug}" has no ${currency} price and will render without one. ` +
      `It holds: ${held}. Prices are never substituted across currencies.`,
  )
}
