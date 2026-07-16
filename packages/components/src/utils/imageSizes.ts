/**
 * Helpers for deriving next/image `sizes` hints from layout geometry.
 *
 * A `sizes` value tells the browser how wide an image renders at each
 * breakpoint so it can pick the smallest sufficient srcset candidate. Without
 * one, next/image assumes `sizes="100vw"` and over-fetches a full-viewport
 * image into a partial-width slot.
 *
 * These helpers only ever *over*-declare (they ignore the container max-width
 * and inter-column gaps, which make real slots slightly narrower). Over-
 * declaring costs a few wasted bytes; under-declaring would ship a blurry
 * image — so the rounding here always rounds up.
 */

/**
 * Round up to two decimals so a derived length never under-declares. The
 * epsilon absorbs floating-point noise (e.g. 33.34 × 0.5 = 16.670000000000002)
 * so a value that is already clean to two decimals isn't nudged up a step.
 */
const roundUpTwo = (n: number): number => Math.ceil(n * 100 - 1e-9) / 100

/** A slot occupying `1 / columns` of the viewport, as a `vw` length. */
const columnVw = (columns: number): string => `${roundUpTwo(100 / Math.max(1, columns))}vw`

// Layout breakpoints — must match GridBlock.module.css and
// ColumnsBlock.module.css (both go multi-column at 769px; the grid adds a
// third column count at 992px).
const TABLET_MIN_PX = 769
const DESKTOP_MIN_PX = 992

export type GridSlotSizesInput = {
  sizingMode: 'fixed' | 'auto'
  columnsMobile: number
  columnsTablet: number
  columnsDesktop: number
  /** minmax() floor for `auto` mode, in px. */
  minItemWidth: number
}

/**
 * The `sizes` a GridBlock cell occupies.
 *
 * `fixed` mode mirrors the CSS breakpoints (1 col < 769px, tablet count from
 * 769px, desktop count from 992px), so a cell is `100 / columns` of the
 * viewport at each.
 *
 * `auto` mode uses `repeat(auto-fit, minmax(minItemWidth, 1fr))`: a cell is
 * never narrower than `minItemWidth` and never reaches `2 × minItemWidth`
 * (at which point another column fits). Capping the hint at `2 × minItemWidth`
 * above that viewport, and 100vw below it (single column), is the tight safe
 * upper bound.
 */
export function gridBlockSlotSizes(input: GridSlotSizesInput): string {
  if (input.sizingMode === 'auto') {
    const capPx = 2 * input.minItemWidth
    return `(min-width: ${capPx}px) ${capPx}px, 100vw`
  }
  return [
    `(min-width: ${DESKTOP_MIN_PX}px) ${columnVw(input.columnsDesktop)}`,
    `(min-width: ${TABLET_MIN_PX}px) ${columnVw(input.columnsTablet)}`,
    columnVw(input.columnsMobile),
  ].join(', ')
}

/**
 * The `sizes` a ColumnsBlock column occupies. Columns stack to a single
 * full-width column below 769px, then sit side-by-side as `100 / columnCount`
 * equal columns from 769px up (ColumnsBlock.module.css). A single column (or
 * none) is full-width at every breakpoint.
 */
export function columnsBlockSlotSizes(columnCount: number): string {
  const columns = Math.max(1, columnCount)
  if (columns === 1) return '100vw'
  return `(min-width: ${TABLET_MIN_PX}px) ${columnVw(columns)}, 100vw`
}

/**
 * Scale a single `<number>vw|px` length token by `fraction`. Returns null for
 * anything else (e.g. a `calc()` or a `rem` token), signalling "leave alone".
 */
const scaleLength = (token: string, fraction: number): string | null => {
  const unit = token.endsWith('vw') ? 'vw' : token.endsWith('px') ? 'px' : null
  if (unit === null) return null
  const value = Number(token.slice(0, -2))
  if (!Number.isFinite(value)) return null
  return `${roundUpTwo(value * fraction)}${unit}`
}

/**
 * Scale every length in a `sizes` string by `fraction`, preserving the media
 * conditions — e.g. halving `(min-width: 992px) 34vw, 100vw` gives
 * `(min-width: 992px) 17vw, 50vw`.
 *
 * Used when an image fills only a fraction of its slot (e.g. a MediaCard whose
 * image sits beside the text). A `fraction` of 1 returns the input untouched;
 * an entry whose length isn't a plain `vw`/`px` value is passed through as-is
 * (safe — it cannot under-declare). Parsing is done with string ops, not a
 * regex, to keep it free of backtracking risk.
 */
export function scaleSizes(sizes: string, fraction: number): string {
  if (fraction === 1) return sizes
  return sizes
    .split(',')
    .map((part) => {
      const entry = part.trim()
      // The length is the last whitespace-separated token; anything before it
      // is the media condition (e.g. `(min-width: 992px)`), kept verbatim.
      const lastSpace = entry.lastIndexOf(' ')
      const lengthToken = lastSpace === -1 ? entry : entry.slice(lastSpace + 1)
      const scaled = scaleLength(lengthToken, fraction)
      if (scaled === null) return entry
      return lastSpace === -1 ? scaled : `${entry.slice(0, lastSpace)} ${scaled}`
    })
    .join(', ')
}
