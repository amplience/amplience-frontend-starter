import clsx from 'clsx'

import type { MediaLoadPriority, ResolvedProduct } from '@amplience/frontend-starter-types'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import type { CarouselScrollStep } from '../../molecules/Carousel/Carousel'
import { SectionHeader } from '../../molecules/SectionHeader/SectionHeader'
import type { SectionHeaderProps } from '../../molecules/SectionHeader/SectionHeader'
import { ProductCarousel } from '../ProductCarousel/ProductCarousel'
import type { ProductCarouselProps } from '../ProductCarousel/ProductCarousel'
import styles from './ProductCarouselBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductCarouselBlockColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'

export type ProductCarouselBlockBackgroundColor = ProductCarouselBlockColorToken

export type ProductCarouselBlockProps = {
  /** Products to show, in the order the content listed their SKUs. */
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
  /**
   * Optional heading group above the rail. Its title doubles as the rail's
   * accessible name, so a page with several rails is navigable without an
   * extra authored field.
   */
  readonly sectionHeader?: Omit<SectionHeaderProps, 'className'>
  readonly backgroundColor?: ProductCarouselBlockBackgroundColor
  readonly maxWidth?: ContainerProps['maxWidth']
  readonly gutter?: ContainerProps['gutter']
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
 * ProductCarouselBlock organism (ADR-0027) — a section wrapping a rail of
 * products a content author curated by SKU.
 *
 * Responsibilities split as they do for CarouselBlock: this owns the section
 * chrome — band, container, max-width, gutter, header — and `ProductCarousel`
 * owns the rail. Neither fetches: the products arrive resolved, because the
 * renderer resolved them before dispatch.
 *
 * Renders nothing when no products resolved. A rail whose SKUs were all
 * unpublished is a real state, and an empty band with a heading reads as a
 * fault rather than as absence.
 */
export function ProductCarouselBlock({
  products,
  slidesMobile,
  slidesTablet,
  slidesDesktop,
  gap,
  showArrows,
  showDots,
  showScrollbar,
  dragToScroll,
  scrollStep,
  sectionHeader,
  backgroundColor,
  maxWidth = 'default',
  gutter = true,
  locale,
  localeBasePath,
  loadPriority,
  className,
}: ProductCarouselBlockProps) {
  if (products.length === 0) return null

  // Forward only what was set, so ProductCarousel's defaults stay the single
  // source of truth for an unconfigured rail.
  const carouselProps: ProductCarouselProps = {
    products,
    ...(slidesMobile != null && { slidesMobile }),
    ...(slidesTablet != null && { slidesTablet }),
    ...(slidesDesktop != null && { slidesDesktop }),
    ...(gap != null && { gap }),
    ...(showArrows != null && { showArrows }),
    ...(showDots != null && { showDots }),
    ...(showScrollbar != null && { showScrollbar }),
    ...(dragToScroll != null && { dragToScroll }),
    ...(scrollStep != null && { scrollStep }),
    ...(sectionHeader?.title?.trim() && { label: sectionHeader.title }),
    ...(locale != null && { locale }),
    ...(localeBasePath != null && { localeBasePath }),
    ...(loadPriority != null && { loadPriority }),
  }

  return (
    <section
      className={clsx('ProductCarouselBlock', styles.root, className)}
      data-background-color={backgroundColor}
    >
      <Container className={styles.container ?? ''} maxWidth={maxWidth} gutter={gutter}>
        {sectionHeader !== undefined && (
          <SectionHeader {...sectionHeader} className={clsx(styles.header)} />
        )}
        <ProductCarousel {...carouselProps} />
      </Container>
    </section>
  )
}
