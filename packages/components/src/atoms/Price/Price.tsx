import clsx from 'clsx'
import type { ComponentPropsWithoutRef } from 'react'

import styles from './Price.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PriceProps = {
  /** Amount in **major** units — 19.99, not 1999 (ADR-0018). */
  amount: number
  /** ISO 4217 code, e.g. GBP, USD, JPY. */
  currencyCode: string
  /**
   * BCP 47 locale governing symbol placement, grouping and decimal marks.
   * Supplied by the route from the active locale; falls back to the runtime
   * default, which in a server render is the *server's* locale — so pass it
   * explicitly anywhere the value is user-visible.
   */
  locale?: string
  className?: string
} & Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'className'>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Price atom — a formatted monetary amount.
 *
 * Formatting lives here rather than in content so the same stored amount
 * renders correctly per locale: `Intl.NumberFormat` places the symbol,
 * chooses the separators, and knows each currency's minor-unit count (2 for
 * GBP, 0 for JPY, 3 for BHD) without anything upstream having to.
 *
 * Renders a `<data>` element carrying the machine-readable amount, so the
 * displayed string stays presentational and assistive tech and scrapers get
 * the raw number.
 *
 *   <Price amount={749} currencyCode="GBP" locale="en-GB" />   → £749.00
 *   <Price amount={749} currencyCode="EUR" locale="de-DE" />   → 749,00 €
 */
export function Price({ amount, currencyCode, locale, className, ...rest }: PriceProps) {
  const formatted = formatPrice(amount, currencyCode, locale)

  return (
    <data className={clsx('Price', styles.root, className)} value={String(amount)} {...rest}>
      {formatted}
    </data>
  )
}

/**
 * Format an amount, degrading to `amount + code` if the currency code is one
 * `Intl` rejects. A malformed code is a content error, and showing
 * `749 XYZ` surfaces it; throwing would take out the whole page over one
 * mistyped field.
 */
export function formatPrice(amount: number, currencyCode: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(
      amount,
    )
  } catch {
    return `${String(amount)} ${currencyCode}`
  }
}
