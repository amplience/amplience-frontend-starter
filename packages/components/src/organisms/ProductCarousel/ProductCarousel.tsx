import clsx from 'clsx'

import type { ContentMediaData, MediaLoadPriority } from '@amplience/frontend-starter-types'

import { Container } from '../../atoms/Container/Container'
import { Carousel } from '../../molecules/Carousel/Carousel'
import type { CarouselScrollStep } from '../../molecules/Carousel/Carousel'
import { ProductCard } from '../../molecules/ProductCard/ProductCard'
import type { ProductCardStatus } from '../../molecules/ProductCard/ProductCard'
import { SectionHeader } from '../../molecules/SectionHeader/SectionHeader'
import type { SectionHeaderProps } from '../../molecules/SectionHeader/SectionHeader'
import { carouselSlotSizes } from '../../utils/imageSizes'
import styles from './ProductCarousel.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One product as this organism needs it — the presentational subset of the
 * normalised `Product` from the `ProductSource` port (ADR-0018).
 *
 * Restated here rather than imported so `packages/components` keeps no
 * dependency on `packages/content`: a component library that imports a data
 * package can't be used against a different one, which is the whole point of
 * the port. The route maps `Product` → this at the composition boundary.
 */
export type ProductCarouselItem = {
  readonly slug: string
  readonly name: string
  readonly href: string
  readonly price?: { readonly amount: number; readonly currencyCode: string }
  readonly media?: ContentMediaData
  readonly shortDescription?: string
  readonly status?: ProductCardStatus
}

export type ProductCarouselProps = {
  /** Products to show, in the order given. */
  readonly products: readonly ProductCarouselItem[]
  /** Optional heading group above the track — spread into SectionHeader. */
  readonly sectionHeader?: Omit<SectionHeaderProps, 'className'>
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
 * ProductCarousel organism — a horizontal rail of `ProductCard`s.
 *
 * Composes the `Carousel` molecule rather than reimplementing a track
 * (ADR-0020 §5), and `ProductCard` rather than its own tile — which is why
 * `ProductCard` was promoted to the library instead of living local to the
 * listing route.
 *
 * Purely presentational: it receives products, it does not fetch them. The
 * `ProductSource` port is async and a registry adapter is synchronous, so
 * whatever resolves `skus[]` into products sits above this component, at the
 * composition boundary that already holds the source.
 *
 * Renders nothing when given no products — a rail with an empty track is
 * worse than an absent section, and a curated rail whose SKUs have all been
 * unpublished is a real state (`getBySkus` drops misses silently).
 */
export function ProductCarousel({
  products,
  sectionHeader,
  slidesMobile = 1.2,
  slidesTablet = 3,
  slidesDesktop = 4,
  gap,
  showArrows = true,
  showDots = false,
  showScrollbar = false,
  dragToScroll = true,
  scrollStep = 'slide',
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
    <section className={clsx('ProductCarousel', styles.root, className)}>
      <Container>
        {sectionHeader !== undefined && (
          <SectionHeader {...sectionHeader} className={clsx(styles.header)} />
        )}

        <Carousel
          slidesMobile={slidesMobile}
          slidesTablet={slidesTablet}
          slidesDesktop={slidesDesktop}
          showArrows={showArrows}
          showDots={showDots}
          showScrollbar={showScrollbar}
          dragToScroll={dragToScroll}
          scrollStep={scrollStep}
          label={sectionHeader?.title ?? 'Products'}
          {...(gap !== undefined && { gap })}
        >
          {products.map((product, index) => (
            <ProductCard
              key={product.slug}
              name={product.name}
              href={product.href}
              sizes={slotSizes}
              // Only the first slide can be above the fold; the rest are
              // off-screen by definition, which is what lazy loading is for.
              loadPriority={index === 0 ? loadPriority : 'lazy'}
              {...(product.price !== undefined && { price: product.price })}
              {...(product.media !== undefined && { media: product.media })}
              {...(product.shortDescription !== undefined && {
                shortDescription: product.shortDescription,
              })}
              {...(product.status !== undefined && { status: product.status })}
              {...(locale !== undefined && { locale })}
              {...(localeBasePath !== undefined && { localeBasePath })}
            />
          ))}
        </Carousel>
      </Container>
    </section>
  )
}
