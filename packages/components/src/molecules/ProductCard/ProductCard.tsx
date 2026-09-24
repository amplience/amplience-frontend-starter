import clsx from 'clsx'

import type { ContentMediaData, MediaLoadPriority } from '@amplience/frontend-starter-types'

import { Card } from '../../atoms/Card/Card'
import { Link } from '../../atoms/Link/Link'
import { Price } from '../../atoms/Price/Price'
import { Typography } from '../../atoms/Typography/Typography'
import { ContentMedia } from '../ContentMedia/ContentMedia'
import { mediaLoadingProps } from '../ContentMedia/mediaLoadingProps'
import styles from './ProductCard.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductCardStatus = 'active' | 'coming-soon' | 'discontinued'

export type ProductCardProps = {
  /** Product display name — the card heading and the link text. */
  name: string
  /** Where the card links. Usually `/products/{slug}`. */
  href: string
  /** Amount in major units. Omit for a product with no price. */
  price?: { amount: number; currencyCode: string }
  /** Lead image. Omit for a product with none — the card renders text-only. */
  media?: ContentMediaData
  /** Brand or vendor name, rendered above the product name. */
  brand?: string
  /** A sentence of body copy under the name. */
  shortDescription?: string
  /**
   * Editorial lifecycle. `active` shows no badge — it is the normal case and
   * a badge on every card is noise. Anything else is worth flagging.
   */
  status?: ProductCardStatus
  /** BCP 47 locale for price formatting. See `Price`. */
  locale?: string
  /** Active locale URL prefix (ADR-0015), supplied by the renderer. */
  localeBasePath?: string
  /**
   * Heading element for the product name. Defaults to `'h3'` — adjust to fit
   * the surrounding document outline.
   */
  headingVariant?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  /**
   * next/image `sizes` describing the width the card occupies in its layout,
   * injected by whatever knows the column geometry (a grid, a carousel).
   * Omit when the slot width is unknown — next/image then keeps its 100vw
   * default rather than guessing a grid that may not exist.
   */
  sizes?: string
  /**
   * How urgently the image should load (ADR-0021). Supplied by the renderer
   * or the route, never authored. Cards are usually below the fold, so
   * `'lazy'` is the default.
   */
  loadPriority?: MediaLoadPriority
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProductCard molecule — one product in a grid or a carousel.
 *
 * Composes `Card` directly rather than wrapping `MediaCard`, because a price
 * has to sit inside the card body in a specific relationship to the name,
 * and `MediaCard` has no slot for it. The two share a look and a set of
 * props by intent, not by inheritance.
 *
 * The whole card is one link. Nothing inside it is separately interactive —
 * a nested control inside a card-sized link is both invalid markup and a
 * hard target on touch.
 *
 * Every visual element is optional except the name: a product with no image,
 * no price and no description still renders as a legible card. That is the
 * `coming-soon` case, and it is a fixture (`aurora-shelving`) rather than a
 * hypothetical.
 *
 *   <ProductCard name="Aurora Lounge Chair" href="/products/aurora-lounge-chair"
 *                price={{ amount: 749, currencyCode: 'GBP' }} media={…} />
 */
export function ProductCard({
  name,
  href,
  price,
  media,
  brand,
  shortDescription,
  status = 'active',
  locale,
  localeBasePath,
  headingVariant = 'h3',
  sizes,
  loadPriority = 'lazy',
  className,
}: ProductCardProps) {
  return (
    <Link
      href={href}
      className={clsx('ProductCard', styles.root, className)}
      {...(localeBasePath !== undefined && { localeBasePath })}
    >
      <Card interactive elevation="flat" padding="none" className={clsx(styles.card)}>
        <div className={styles.media} data-empty={media === undefined ? 'true' : undefined}>
          {media !== undefined && (
            <ContentMedia
              {...media}
              {...mediaLoadingProps(loadPriority)}
              {...(sizes !== undefined && { sizes })}
              {...(styles.image !== undefined && { className: styles.image })}
            />
          )}
          {status !== 'active' && (
            <span className={styles.status} data-status={status}>
              {STATUS_LABELS[status]}
            </span>
          )}
        </div>

        <div className={styles.body}>
          {brand !== undefined && (
            <Typography variant="p" className={clsx(styles.brand)}>
              {brand}
            </Typography>
          )}

          <Typography variant={headingVariant} className={clsx(styles.name)}>
            {name}
          </Typography>

          {shortDescription !== undefined && (
            <Typography variant="p" className={clsx(styles.description)}>
              {shortDescription}
            </Typography>
          )}

          {price !== undefined && (
            <Price
              amount={price.amount}
              currencyCode={price.currencyCode}
              className={clsx(styles.price)}
              {...(locale !== undefined && { locale })}
            />
          )}
        </div>
      </Card>
    </Link>
  )
}

/**
 * Badge text per status. `active` has no entry — it renders no badge at all,
 * so the type excludes it at the call site above rather than mapping it to
 * an empty string.
 */
const STATUS_LABELS: Record<Exclude<ProductCardStatus, 'active'>, string> = {
  'coming-soon': 'Coming soon',
  discontinued: 'Discontinued',
}
