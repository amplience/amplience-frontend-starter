import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { HeroBlock, type HeroBlockProps } from './HeroBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const HERO_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/hero'

/** The hero delivery body — HeroBlock props plus the content envelope. */
export type HeroBlockSchema = HeroBlockProps & { readonly _meta: unknown }

/**
 * Registry entry for the hero schema. The adapter strips the `_meta`
 * envelope; the remaining fields are the component's props one-for-one.
 */
export const heroBlockRegistryEntry: ComponentRegistryEntry<HeroBlockSchema, HeroBlockProps> = {
  component: HeroBlock,
  propsFromSchema: ({ _meta: _envelope, ...props }) => props,
}
