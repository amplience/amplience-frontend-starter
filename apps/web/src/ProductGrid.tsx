/**
 * The product grid shared by `/products` and by category listings (ADR-0024).
 *
 * Extracted from the listing route when categories gained URLs: two routes
 * rendering the same grid from the same normalised `Product[]` is exactly the
 * duplication that drifts, and the image-loading wiring below is the part
 * most likely to drift silently.
 *
 * Presentational and source-agnostic — it takes `Product[]` from the
 * `ProductSource` port and knows nothing about where they came from, so a PIM
 * adapter changes nothing here.
 *
 * Image loading is wired by hand because the demotion ladder (ADR-0021) only
 * runs inside the renderer and these routes compose components directly: the
 * first row takes `'eager'`, everything below is `'lazy'`. The blog archive
 * omits this and lazy-loads every card at a 100vw srcset; it is a defect to
 * avoid copying, not a precedent.
 */

import { Container } from '@amplience/frontend-starter-components/container'
import { GridBlock } from '@amplience/frontend-starter-components/grid-block'
import { gridBlockSlotSizes } from '@amplience/frontend-starter-components/image-sizes'
import { ProductCard } from '@amplience/frontend-starter-components/product-card'
import type { Product } from '@amplience/frontend-starter-content'

import { localeBasePath, publicPath } from '../lib/locales'
import type { Locale } from '../lib/locales'
import { productMedia } from '../lib/product-media'

/**
 * Grid geometry — one source of truth for the CSS floor and the `sizes` hint.
 *
 * `auto` rather than fixed column counts: the browser fits as many columns as
 * it can without a cell dropping below this width, so the grid reflows at
 * every width instead of only at two breakpoints.
 */
const MIN_ITEM_WIDTH = 220

/**
 * `sizes` for one card. In `auto` mode a cell is never narrower than
 * `minItemWidth` and never reaches `2 × minItemWidth` (another column would
 * fit), so that doubled value is the tight safe cap. The column counts are
 * ignored in this mode but the input type requires them.
 */
const CARD_SIZES = gridBlockSlotSizes({
  sizingMode: 'auto',
  minItemWidth: MIN_ITEM_WIDTH,
  columnsMobile: 0,
  columnsTablet: 0,
  columnsDesktop: 0,
})

/**
 * How many cards load eagerly — an estimate of the first row, not a derived
 * count.
 *
 * It cannot be derived. Auto sizing makes the column count a property of the
 * rendered width, and the two inputs that decide it — `--site-max-width` and
 * `--gap` — are *theme* tokens a brand can rebind, including at runtime via
 * the CMS custom-CSS layer (ADR-0016). So no constant here is right for every
 * theme, and this one is tuned to the default: four columns at its max width.
 *
 * Erring low is deliberate. The first card is always eager, so the LCP
 * candidate is protected whatever the theme; a wider theme merely leaves the
 * tail of its first row to `loading="lazy"`, which browsers still fetch
 * immediately when the image is in the viewport — it just misses the preload
 * scanner. Erring high would cost eager fetches below the fold on mobile,
 * where the grid is one column and every card past the first is off-screen.
 */
const EAGER_CARDS = 4

export type ProductGridProps = {
  readonly products: readonly Product[]
  readonly locale: Locale
  /** Shown in place of the grid when there is nothing to list. */
  readonly emptyMessage?: string
}

export function ProductGrid({
  products,
  locale,
  emptyMessage = 'No products published yet.',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <Container gutter>
        <p data-product-listing-empty>{emptyMessage}</p>
      </Container>
    )
  }

  return (
    // No `data-*` marker here: `GridBlockProps` is a closed type with no rest
    // spread, so one would be silently dropped — and TypeScript won't say so,
    // because JSX attributes containing a hyphen aren't checked against a
    // component's props type. The listing routes mark themselves on `<main>`.
    <GridBlock gutter sizingMode="auto" minItemWidth={MIN_ITEM_WIDTH} backgroundColor="light">
      {products.map((product, index) => {
        const media = productMedia(product.images?.[0])
        return (
          <ProductCard
            key={product.slug}
            name={product.name}
            href={publicPath(locale, `/products/${product.slug}`)}
            sizes={CARD_SIZES}
            loadPriority={index < EAGER_CARDS ? 'eager' : 'lazy'}
            locale={locale.code}
            localeBasePath={localeBasePath(locale)}
            {...(product.price !== undefined && { price: product.price })}
            {...(product.brand !== undefined && { brand: product.brand })}
            {...(media !== undefined && { media })}
            {...(product.shortDescription !== undefined && {
              shortDescription: product.shortDescription,
            })}
            {...(product.status !== undefined && { status: product.status })}
          />
        )
      })}
    </GridBlock>
  )
}
