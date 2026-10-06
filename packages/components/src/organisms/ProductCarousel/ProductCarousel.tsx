import clsx from 'clsx'

import type { MediaLoadPriority, ResolvedProduct } from '@amplience/frontend-starter-types'

import { Carousel } from '../../molecules/Carousel/Carousel'
import type { CarouselScrollStep } from '../../molecules/Carousel/Carousel'
import { ProductCard } from '../../molecules/ProductCard/ProductCard'
import { carouselSlotSizes } from '../../utils/imageSizes'
import styles from './ProductCarousel.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductCarouselProps = {
  /** Products to show, in the order given. */
  readonly products: readonly ResolvedProduct[]
  /** Slides visible below 769px. Defaults to 1.2 — the peek affordance. */
  readonly slidesMobile?: number
  /** Slides visible from 769px. Defaults to 3. */
  readonly slidesTablet?: number
  /** Slides visible from 992px. Defaults to 4. */
  readonly slidesDesktop?: number
  /** Gap between slides, in px. */
  readonly gap?: number
  readonly showArrows?: boolean
  readonly showDots?: boolean
  readonly showScrollbar?: boolean
  readonly dragToScroll?: boolean
  readonly scrollStep?: CarouselScrollStep
  /** Accessible name for the track. Defaults to 'Products'. */
  readonly label?: string
  /** BCP 47 locale for price formatting. See `Price`. */
  readonly locale?: string
  /** Active locale URL prefix (ADR-0015), supplied by the renderer. */
  readonly localeBasePath?: string
  /** How urgently the *first* slide's image loads. The rest stay lazy. */
  readonly loadPriority?: MediaLoadPriority
  readonly className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProductCarousel — a horizontal rail of `ProductCard`s.
 *
 * The track only. Section chrome — band, container, header — belongs to
 * `ProductCarouselBlock`, the same split `Carousel` and `CarouselBlock` use.
 *
 * Purely presentational: it receives products, it does not fetch them
 * (ADR-0027). Renders nothing when given none, since a rail whose SKUs have all
 * been unpublished is a real state and an empty track reads as broken.
 */
export function ProductCarousel({
  products,
  slidesMobile = 1.2,
  slidesTablet = 3,
  slidesDesktop = 4,
  gap,
  showArrows = true,
  showDots = false,
  showScrollbar = false,
  dragToScroll = true,
  scrollStep = 'slide',
  label = 'Products',
  locale,
  localeBasePath,
  loadPriority = 'lazy',
  className,
}: ProductCarouselProps) {
  if (products.length === 0) return null

  // Each slide is this wide, so the cards inside size their srcset to the
  // slide rather than the viewport (ADR-0021 §9).
  const slotSizes = carouselSlotSizes({ slidesMobile, slidesTablet, slidesDesktop })

  return (
    <Carousel
      className={clsx('ProductCarousel', styles.root, className)}
      slidesMobile={slidesMobile}
      slidesTablet={slidesTablet}
      slidesDesktop={slidesDesktop}
      showArrows={showArrows}
      showDots={showDots}
      showScrollbar={showScrollbar}
      dragToScroll={dragToScroll}
      scrollStep={scrollStep}
      label={label}
      {...(gap !== undefined && { gap })}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.sku}
          name={product.name}
          href={product.href}
          sizes={slotSizes}
          // Only the first slide can be above the fold; the rest are off-screen
          // by definition, which is what lazy loading is for.
          loadPriority={index === 0 ? loadPriority : 'lazy'}
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
    </Carousel>
  )
}
