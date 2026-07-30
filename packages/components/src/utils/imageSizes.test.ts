// Tests for the image `sizes` helpers — pure geometry, no DOM.

import { describe, expect, it } from 'vitest'

import {
  carouselSlotSizes,
  columnsBlockSlotSizes,
  gridBlockSlotSizes,
  scaleSizes,
} from './imageSizes'

describe('gridBlockSlotSizes — fixed mode', () => {
  it('maps the default 1/2/3 column counts to the CSS breakpoints', () => {
    expect(
      gridBlockSlotSizes({
        sizingMode: 'fixed',
        columnsMobile: 1,
        columnsTablet: 2,
        columnsDesktop: 3,
        minItemWidth: 250,
      }),
    ).toBe('(min-width: 992px) 33.34vw, (min-width: 769px) 50vw, 100vw')
  })

  it('rounds a column width up so it never under-declares', () => {
    // 100 / 3 = 33.33… → rounded up to 33.34
    expect(
      gridBlockSlotSizes({
        sizingMode: 'fixed',
        columnsMobile: 3,
        columnsTablet: 3,
        columnsDesktop: 3,
        minItemWidth: 250,
      }),
    ).toBe('(min-width: 992px) 33.34vw, (min-width: 769px) 33.34vw, 33.34vw')
  })

  it('handles a four-column desktop grid', () => {
    expect(
      gridBlockSlotSizes({
        sizingMode: 'fixed',
        columnsMobile: 1,
        columnsTablet: 2,
        columnsDesktop: 4,
        minItemWidth: 250,
      }),
    ).toBe('(min-width: 992px) 25vw, (min-width: 769px) 50vw, 100vw')
  })
})

describe('gridBlockSlotSizes — auto mode', () => {
  it('caps at twice the min item width (the point another column fits)', () => {
    expect(
      gridBlockSlotSizes({
        sizingMode: 'auto',
        columnsMobile: 1,
        columnsTablet: 2,
        columnsDesktop: 3,
        minItemWidth: 250,
      }),
    ).toBe('(min-width: 500px) 500px, 100vw')
  })
})

describe('columnsBlockSlotSizes', () => {
  it('is full-width on mobile (stacked) and 1/N side-by-side from 769px', () => {
    expect(columnsBlockSlotSizes(2)).toBe('(min-width: 769px) 50vw, 100vw')
    expect(columnsBlockSlotSizes(3)).toBe('(min-width: 769px) 33.34vw, 100vw')
  })

  it('is full-width at every breakpoint for a single column', () => {
    expect(columnsBlockSlotSizes(1)).toBe('100vw')
  })

  it('treats zero columns as one (avoids divide-by-zero)', () => {
    expect(columnsBlockSlotSizes(0)).toBe('100vw')
  })
})

describe('carouselSlotSizes', () => {
  it('divides the viewport by the slide count at each breakpoint', () => {
    expect(carouselSlotSizes({ slidesMobile: 1, slidesTablet: 2, slidesDesktop: 4 })).toBe(
      '(min-width: 992px) 25vw, (min-width: 769px) 50vw, 100vw',
    )
  })

  it('uses the same breakpoints as the grid', () => {
    // Carousel.module.css resolves --carousel-slides at 769px and 992px, the
    // same steps GridBlock uses — so a card sized for a grid cell and the same
    // card in a slide agree.
    const sizes = carouselSlotSizes({ slidesMobile: 1, slidesTablet: 2, slidesDesktop: 3 })
    expect(sizes).toContain('(min-width: 769px)')
    expect(sizes).toContain('(min-width: 992px)')
  })

  it('handles fractional slide counts', () => {
    // A 1.2-slide peek makes each slide 1/1.2 of the track — 83.34vw, rounded up.
    expect(carouselSlotSizes({ slidesMobile: 1.2, slidesTablet: 2.4, slidesDesktop: 3.4 })).toBe(
      '(min-width: 992px) 29.42vw, (min-width: 769px) 41.67vw, 83.34vw',
    )
  })

  it('caps a slide at the full width of the track', () => {
    // A slide count below 1 would mean no whole slide is ever visible, so the
    // schema floors it at 1 and this floors it again — a slide is never wider
    // than the track it scrolls in.
    expect(carouselSlotSizes({ slidesMobile: 1, slidesTablet: 1, slidesDesktop: 1 })).toBe(
      '(min-width: 992px) 100vw, (min-width: 769px) 100vw, 100vw',
    )
    expect(carouselSlotSizes({ slidesMobile: 0.5, slidesTablet: 0, slidesDesktop: 1 })).toBe(
      '(min-width: 992px) 100vw, (min-width: 769px) 100vw, 100vw',
    )
  })

  it('rounds up so a derived length never under-declares', () => {
    // 100 / 3 = 33.333… → 33.34
    expect(carouselSlotSizes({ slidesMobile: 3, slidesTablet: 3, slidesDesktop: 3 })).toBe(
      '(min-width: 992px) 33.34vw, (min-width: 769px) 33.34vw, 33.34vw',
    )
  })
})

describe('scaleSizes', () => {
  it('returns the input untouched for a fraction of 1', () => {
    const sizes = '(min-width: 992px) 33.34vw, 100vw'
    expect(scaleSizes(sizes, 1)).toBe(sizes)
  })

  it('halves each length while preserving the media conditions', () => {
    expect(scaleSizes('(min-width: 992px) 33.34vw, 100vw', 0.5)).toBe(
      '(min-width: 992px) 16.67vw, 50vw',
    )
  })

  it('scales px lengths too', () => {
    expect(scaleSizes('(min-width: 500px) 500px, 100vw', 0.5)).toBe(
      '(min-width: 500px) 250px, 50vw',
    )
  })

  it('rounds a scaled length up so it never under-declares', () => {
    // 33.33vw × 0.5 = 16.665 → rounded up to 16.67
    expect(scaleSizes('33.33vw', 0.5)).toBe('16.67vw')
  })

  it('passes through an entry whose unit it does not recognise', () => {
    expect(scaleSizes('calc(100vw - 2rem)', 0.5)).toBe('calc(100vw - 2rem)')
  })
})
