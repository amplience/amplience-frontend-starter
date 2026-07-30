// Tests for the carousel registry entry (ADR-0020) — container-entry surface
// (ADR-0010 §4): the envelope and items stay out of the props, and items come
// back as the children the renderer recurses into.

import { describe, expect, it } from 'vitest'

import { carouselBlockRegistryEntry, type CarouselBlockSchema } from './CarouselBlock.registry'

const SCHEMA = 'https://quadratic.amplience.com/v2/content/carousel'

const withItems = {
  _meta: { schema: SCHEMA },
  items: [{ kind: 'child' }],
} as CarouselBlockSchema

const withoutItems = {
  _meta: { schema: SCHEMA },
} as CarouselBlockSchema

describe('carouselBlockRegistryEntry', () => {
  it('strips the envelope and items from the props', () => {
    expect(carouselBlockRegistryEntry.propsFromSchema?.(withItems, {})).toEqual({})
  })

  it('keeps the authored presentation fields in the props', () => {
    const configured = {
      _meta: { schema: SCHEMA },
      items: [{ kind: 'child' }],
      slidesDesktop: 4,
      showDots: false,
      sectionHeader: { title: 'New in' },
    } as CarouselBlockSchema
    expect(carouselBlockRegistryEntry.propsFromSchema?.(configured, {})).toEqual({
      slidesDesktop: 4,
      showDots: false,
      sectionHeader: { title: 'New in' },
    })
  })

  it('hands items back to the renderer as children', () => {
    expect(carouselBlockRegistryEntry.getChildren?.(withItems)).toEqual([{ kind: 'child' }])
  })

  it('treats a block with no items as empty', () => {
    expect(carouselBlockRegistryEntry.getChildren?.(withoutItems)).toEqual([])
  })

  it('renders children bare — nested blocks drop their section wrappers', () => {
    expect(carouselBlockRegistryEntry.childContext).toEqual({ bare: true })
  })

  it('derives the slide width from the default slide counts', () => {
    // Must match the Carousel molecule's own defaults of 1 / 2 / 3.
    expect(carouselBlockRegistryEntry.childContextFromSchema?.(withoutItems, {})).toEqual({
      slotSizes: '(min-width: 992px) 33.34vw, (min-width: 769px) 50vw, 100vw',
    })
  })

  it('derives the slide width from explicit slide counts', () => {
    const fourUp = {
      _meta: { schema: SCHEMA },
      slidesMobile: 1,
      slidesTablet: 2,
      slidesDesktop: 4,
    } as CarouselBlockSchema
    expect(carouselBlockRegistryEntry.childContextFromSchema?.(fourUp, {})).toEqual({
      slotSizes: '(min-width: 992px) 25vw, (min-width: 769px) 50vw, 100vw',
    })
  })

  it('derives the slide width from fractional slide counts', () => {
    const peek = {
      _meta: { schema: SCHEMA },
      slidesMobile: 1.2,
      slidesTablet: 2.4,
      slidesDesktop: 3.4,
    } as CarouselBlockSchema
    expect(carouselBlockRegistryEntry.childContextFromSchema?.(peek, {})).toEqual({
      slotSizes: '(min-width: 992px) 29.42vw, (min-width: 769px) 41.67vw, 83.34vw',
    })
  })
})
