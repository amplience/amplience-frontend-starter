import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { carouselSlotSizes } from '../../utils/imageSizes'
import { CarouselBlock, type CarouselBlockProps } from './CarouselBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const CAROUSEL_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/carousel'

/**
 * The carousel delivery body — CarouselBlock's own props plus the content
 * envelope and the nested `items` the renderer recurses into. `children` is
 * excluded: it arrives from the renderer, not from content.
 */
export type CarouselBlockSchema = Omit<CarouselBlockProps, 'children'> & {
  readonly _meta: unknown
  readonly items?: readonly unknown[]
}

/**
 * Registry entry for the carousel schema. A container entry: `getChildren`
 * hands `items` back to the renderer, which renders them recursively (with
 * `bare` context, so nested blocks drop their section wrappers) and passes the
 * result in as `children`.
 *
 * The item array is deliberately untyped here — dispatch happens per item on
 * schema URI, so a rail of cards, a one-up hero carousel and a mix of the two
 * are all the same code path (ADR-0020). What the CMS allows as a slide is
 * expressed once, in the `carousel-items` partial, not duplicated here.
 */
export const carouselBlockRegistryEntry: ComponentRegistryEntry<
  CarouselBlockSchema,
  CarouselBlockProps
> = {
  component: CarouselBlock,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
  // Tell each slide how wide it renders (defaults mirror the Carousel
  // molecule's own) so media inside it sizes its srcset to the slide rather
  // than the viewport.
  childContextFromSchema: (schema) => ({
    slotSizes: carouselSlotSizes({
      slidesMobile: schema.slidesMobile ?? 1,
      slidesTablet: schema.slidesTablet ?? 2,
      slidesDesktop: schema.slidesDesktop ?? 3,
    }),
  }),
}
