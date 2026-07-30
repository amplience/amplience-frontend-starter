import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { Carousel } from '../../molecules/Carousel/Carousel'
import type { CarouselProps, CarouselScrollStep } from '../../molecules/Carousel/Carousel'
import { SectionHeader } from '../../molecules/SectionHeader/SectionHeader'
import type { SectionHeaderProps } from '../../molecules/SectionHeader/SectionHeader'
import styles from './CarouselBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CarouselBlockColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'

export type CarouselBlockBackgroundColor = CarouselBlockColorToken

export type CarouselBlockProps = {
  children?: ReactNode
  /**
   * Slides visible below 769px. Defaults to 1.
   *
   * Fractional values above 1 give the peek affordance — 1.2 shows one whole
   * slide plus a sliver of the next, which is how a touch user learns the track
   * scrolls. Never below 1: no whole slide would ever be in view.
   */
  slidesMobile?: number
  /** Slides visible from 769px. Defaults to 2. */
  slidesTablet?: number
  /** Slides visible from 992px. Defaults to 3. */
  slidesDesktop?: number
  /**
   * Gap between slides, in px.
   * Defaults to the --gap token (16px at the base scale).
   */
  gap?: number
  /** Show the previous/next arrows. Defaults to true. */
  showArrows?: boolean
  /** Show the pagination dots. Defaults to true. */
  showDots?: boolean
  /** Show the styled scrollbar beneath the track. Defaults to false. */
  showScrollbar?: boolean
  /** Let a mouse drag the slides to scroll. Defaults to true. */
  dragToScroll?: boolean
  /** How far one arrow press moves the track. Defaults to 'slide'. */
  scrollStep?: CarouselScrollStep
  /**
   * Optional heading group rendered above the track — title, subtitle and
   * description spread straight into SectionHeader. See the `section-header`
   * CMS partial, which delivers this same grouped shape.
   *
   * The title doubles as the carousel's accessible name when present, so a page
   * with several carousels is navigable without an extra authored field.
   */
  sectionHeader?: Omit<SectionHeaderProps, 'className'>
  /**
   * Background colour of the section, drawn from the design token palette.
   */
  backgroundColor?: CarouselBlockBackgroundColor
  /**
   * Max-width constraint passed through to the inner Container atom.
   * Defaults to 'default'.
   */
  maxWidth?: ContainerProps['maxWidth']
  /**
   * When true, adds horizontal padding (`--site-gutter`) to the inner Container
   * so the track is inset from the section edge. Omit or set false for
   * edge-to-edge carousels, where slides run to the viewport edge and the peek
   * affordance reads most clearly.
   * Defaults to false.
   */
  gutter?: ContainerProps['gutter']
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CarouselBlock organism (ADR-0020) — a section wrapping a horizontally
 * scrolling track of content items.
 *
 * The split of responsibilities matches GridBlock and ColumnsBlock: this
 * component owns the section chrome — background band, container, max-width,
 * gutter and the optional section header — and the `Carousel` molecule owns the
 * track, its scroll-snap behaviour and its controls. Nothing about scrolling
 * lives here.
 *
 * Items arrive as `children` from the renderer, one per content-link in the
 * CMS `items` array, with no constraint on what they are: a rail of cards, a
 * one-up hero carousel, a quote carousel from rich text, or any mix of those.
 * That the mix works is a property of the array's shape rather than a feature —
 * see ADR-0020.
 *
 * The section header's title, when set, becomes the carousel's accessible name.
 * An unnamed carousel announces as "Carousel", which is unhelpful on a page
 * with several; taking the name from copy the author has already written avoids
 * asking them for it twice.
 *
 * All visual theming reads from --carousel-block-* CSS variables (plus the
 * molecule's own --carousel-* contract); brands override under [data-brand]
 * without touching this file.
 *
 * Usage:
 *   <CarouselBlock slidesMobile={1} slidesTablet={2} slidesDesktop={4}>
 *     <MediaCard … /> <MediaCard … />
 *   </CarouselBlock>
 *
 *   // One-up hero carousel, edge to edge
 *   <CarouselBlock slidesMobile={1} slidesTablet={1} slidesDesktop={1}>
 *     <HeroBlock … /> <HeroBlock … />
 *   </CarouselBlock>
 */
export function CarouselBlock({
  children,
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
  gutter = false,
  className,
}: CarouselBlockProps) {
  // Only forward what the author actually set, so the molecule's own defaults
  // stay the single source of truth for what a carousel looks like unconfigured
  // — passing `undefined` through would work today but would silently diverge
  // if either side's defaults changed.
  const carouselProps: CarouselProps = {
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
  }

  return (
    <section
      className={clsx('CarouselBlock', styles.root, className)}
      data-background-color={backgroundColor}
    >
      <Container className={styles.container ?? ''} maxWidth={maxWidth} gutter={gutter}>
        <SectionHeader {...(sectionHeader ?? {})} />
        <Carousel {...carouselProps}>{children}</Carousel>
      </Container>
    </section>
  )
}
