import { clsx } from 'clsx'

import type { ResolvedProduct } from '@amplience/frontend-starter-types'

import { Container } from '../../atoms/Container/Container'
import { Typography } from '../../atoms/Typography/Typography'
import { ProductCard } from '../../molecules/ProductCard/ProductCard'
import { GridBlock } from '../../organisms/GridBlock/GridBlock'
import { gridBlockSlotSizes } from '../../utils/imageSizes'
import styles from './ProductListingPage.module.css'

export type ProductListingPageProps = {
  /** The listing's name — the page's h1 (a category title, or "Products"). */
  readonly title: string
  /** A line under the title. */
  readonly description?: string
  /** Products to list, in the order given. */
  readonly products: readonly ResolvedProduct[]
  /** Shown in place of the grid when there is nothing to list. */
  readonly emptyMessage?: string
  /** BCP 47 locale for price formatting. See `Price`. */
  readonly locale?: string
  /** Active locale URL prefix (ADR-0015). */
  readonly localeBasePath?: string
  readonly className?: string
}

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
 * fit), so that doubled value is the tight safe cap.
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
 * count. Auto sizing makes the column count a property of the rendered width,
 * which theme tokens (and the CMS custom-CSS layer, ADR-0016) can change, so
 * this is tuned to the default theme: four columns at its max width.
 *
 * Erring low is deliberate: the first card is always eager, so the LCP
 * candidate is protected whatever the theme, while erring high would cost
 * eager fetches below the fold on mobile.
 */
const EAGER_CARDS = 4

/**
 * ProductListingPage — a product listing: a title header over a grid of
 * `ProductCard`s. Serves `/products` and every category URL (ADR-0024).
 *
 * Purely presentational, like `ProductDetailPage`'s counterpart: it receives
 * resolved products and fetches nothing (ADR-0027). The route owns the
 * `<main>` landmark and the data source; this owns the layout.
 *
 * Image loading is wired here because listings compose components directly
 * rather than through the renderer, so the demotion ladder (ADR-0021) never
 * runs: the first row is eager, everything below lazy.
 */
export function ProductListingPage({
  title,
  description,
  products,
  emptyMessage = 'No products published yet.',
  locale,
  localeBasePath,
  className,
}: ProductListingPageProps) {
  return (
    <div className={clsx('ProductListingPage', styles.root, className)} data-product-listing-page>
      <header className={styles.header} data-product-listing-header>
        <Container gutter>
          <Typography variant="h1" className={clsx(styles.title)}>
            {title}
          </Typography>
          {description !== undefined && (
            <Typography variant="p" className={clsx(styles.description)}>
              {description}
            </Typography>
          )}
        </Container>
      </header>

      {products.length === 0 ? (
        <Container gutter>
          <p className={styles.empty} data-product-listing-empty>
            {emptyMessage}
          </p>
        </Container>
      ) : (
        <GridBlock gutter sizingMode="auto" minItemWidth={MIN_ITEM_WIDTH}>
          {products.map((product, index) => (
            <ProductCard
              key={product.sku}
              name={product.name}
              href={product.href}
              sizes={CARD_SIZES}
              loadPriority={index < EAGER_CARDS ? 'eager' : 'lazy'}
              {...(product.price !== undefined && { price: product.price })}
              {...(product.media !== undefined && { media: product.media })}
              {...(product.brand !== undefined && { brand: product.brand })}
              {...(product.shortDescription !== undefined && {
                shortDescription: product.shortDescription,
              })}
              {...(product.status !== undefined && { status: product.status })}
              {...(locale !== undefined && { locale })}
              {...(localeBasePath !== undefined && { localeBasePath })}
            />
          ))}
        </GridBlock>
      )}
    </div>
  )
}
