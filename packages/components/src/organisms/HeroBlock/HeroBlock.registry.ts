import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { HeroBlock, type HeroBlockProps } from './HeroBlock'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const HERO_BLOCK_SCHEMA = 'https://quadratic.amplience.com/v2/content/hero'

/**
 * The hero delivery body — HeroBlock props plus the content envelope.
 * `loadPriority` and `bare` are excluded: both are cues supplied by the render
 * context, not author-editable fields.
 */
export type HeroBlockSchema = Omit<HeroBlockProps, 'loadPriority' | 'bare' | 'localeBasePath'> & {
  readonly _meta: unknown
}

/**
 * Renderer-edge contract validator (ADR-0009 §10, ADR-0010 §7). The hero is
 * the worked example of the `validate` surface: `title` is the one field
 * the component genuinely cannot render without (it drives the <h1> and the
 * section's accessible name), so content missing it fails loudly at the
 * dispatch boundary instead of rendering a broken hero.
 */
export const validateHeroBlockSchema = (schema: unknown): schema is HeroBlockSchema => {
  if (typeof schema !== 'object' || schema === null) return false
  const title = (schema as { title?: unknown }).title
  return typeof title === 'string' && title.trim().length > 0
}

/**
 * Registry entry for the hero schema. The adapter strips the `_meta`
 * envelope and sets two cues from the render context: `loadPriority`, so a hero
 * near the top of the page loads its image more urgently than one further down
 * (ADR-0021), and `bare`, so a hero nested in a carousel slide, grid cell or
 * column drops its own gutter instead of compounding the parent's. The
 * remaining fields are the component's props one-for-one.
 */
export const heroBlockRegistryEntry: ComponentRegistryEntry<HeroBlockSchema, HeroBlockProps> = {
  component: HeroBlock,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    loadPriority: ctx.loadPriority ?? 'lazy',
    bare: ctx.bare ?? false,
    localeBasePath: ctx.localeBasePath ?? '',
  }),
  validate: validateHeroBlockSchema,
}
