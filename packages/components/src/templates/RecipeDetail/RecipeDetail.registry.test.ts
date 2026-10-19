// Tests for the recipe registry entry — the schema→props adapter, the
// dual-URI registration, head metadata and schema.org JSON-LD.
//
// The JSON-LD builder is the part with real branching: every field is
// conditional on the content holding it, and an invented or malformed value
// there is worse than a missing one (it is read by search engines, not people).

import { describe, expect, it } from 'vitest'

import { defaultRegistry } from '../../registry'
import {
  RECIPE_DEMO_SCHEMA,
  RECIPE_SCHEMA,
  recipeJsonLd,
  recipeMetadataFromSchema,
  recipeRegistryEntry,
  type RecipeSchema,
} from './RecipeDetail.registry'

const heroImage = { name: 'soup', endpoint: 'demo-store', defaultHost: 'cdn.media.amplience.net' }

const base: RecipeSchema = { _meta: {}, title: 'Slow-roast tomato soup' }

const full: RecipeSchema = {
  ...base,
  recipeId: 'U1234567',
  subtitle: 'Tomatoes roasted slowly, then blended with white beans',
  serves: 4,
  heroImage,
  heroAltText: 'A bowl of tomato soup',
  imageIsAiEnhanced: true,
  copy: { intro: 'A **simple** classic.' },
  ingredients: [
    { name: 'Plum tomatoes', quantity: '280g', productCode: '100234' },
    { name: 'Cannellini beans' },
  ],
  preparation: 'Blend until smooth.',
  methodSteps: ['Roast the tomatoes.', 'Blend with the beans.'],
  methodNotes: 'NB: loosen with stock.',
  allergens: ['Soya'],
  nutrition: { kcalPer100g: 147, portionWeightG: 475, portionKcal: 719, carbsPercent: 30 },
  seo: { metaTitle: 'Tomato soup', metaDescription: 'Tomatoes and beans' },
  recipePdfUrl: 'https://example.com/soup.pdf',
  source: { origin: 'nutritics', sourceLastModified: '2024-11-06' },
}

describe('recipe registration', () => {
  it('is registered under both the starter and the demo-host schema URIs', () => {
    expect(defaultRegistry.get(RECIPE_SCHEMA)).toBe(recipeRegistryEntry)
    expect(defaultRegistry.get(RECIPE_DEMO_SCHEMA)).toBe(recipeRegistryEntry)
  })
})

describe('recipeRegistryEntry — propsFromSchema', () => {
  const adapt = recipeRegistryEntry.propsFromSchema

  it('maps the content fields and drops the envelope', () => {
    const props = adapt?.(full, { localeBasePath: '/fr-fr' })
    expect(props).toMatchObject({
      title: 'Slow-roast tomato soup',
      subtitle: 'Tomatoes roasted slowly, then blended with white beans',
      serves: 4,
      intro: 'A **simple** classic.',
      preparation: 'Blend until smooth.',
      methodSteps: ['Roast the tomatoes.', 'Blend with the beans.'],
      methodNotes: 'NB: loosen with stock.',
      allergens: ['Soya'],
      imageIsAiEnhanced: true,
      recipePdfUrl: 'https://example.com/soup.pdf',
      localeBasePath: '/fr-fr',
    })
    expect(props).not.toHaveProperty('_meta')
    expect(props).not.toHaveProperty('seo')
  })

  it('wraps the bare DAM image-link as a DynamicImage, carrying the alt text', () => {
    expect(adapt?.(full, {})?.heroImage).toEqual({
      mediaType: 'DynamicImage',
      image: { image: heroImage },
      imageAltText: 'A bowl of tomato soup',
    })
  })

  it('omits the hero when the image link is incomplete', () => {
    const props = adapt?.({ ...base, heroImage: { name: 'x' } as never }, {})
    expect(props).not.toHaveProperty('heroImage')
  })

  it('omits absent fields rather than passing undefined through', () => {
    const props = adapt?.(base, {})
    for (const key of ['subtitle', 'serves', 'intro', 'ingredients', 'allergens', 'nutrition']) {
      expect(props).not.toHaveProperty(key)
    }
  })

  it('falls back to an empty title rather than throwing', () => {
    expect(adapt?.({ _meta: {} }, {})?.title).toBe('')
  })

  it('sets loadPriority from the render context, defaulting to lazy', () => {
    expect(adapt?.(base, {})?.loadPriority).toBe('lazy')
    expect(adapt?.(base, { loadPriority: 'lcp' })?.loadPriority).toBe('lcp')
  })

  it('is a leaf: it declares no children', () => {
    expect(recipeRegistryEntry.getChildren).toBeUndefined()
  })
})

describe('recipeMetadataFromSchema', () => {
  it('prefers the SEO fields over the title and summary', () => {
    const meta = recipeMetadataFromSchema(full)
    expect(meta.title).toBe('Tomato soup')
    expect(meta.description).toBe('Tomatoes and beans')
    expect(meta.openGraph).toMatchObject({
      title: 'Tomato soup',
      description: 'Tomatoes and beans',
    })
  })

  it('falls back to the recipe title and chef summary', () => {
    const meta = recipeMetadataFromSchema({ ...base, subtitle: 'Chef summary' })
    expect(meta.title).toBe('Slow-roast tomato soup')
    expect(meta.description).toBe('Chef summary')
  })

  it('builds an og:image from the hero, capped at 1200px', () => {
    const meta = recipeMetadataFromSchema(full)
    expect(meta.openGraph?.images?.[0]).toContain('w=1200')
  })

  it('adds a canonical only when a path is supplied', () => {
    expect(recipeMetadataFromSchema(base)).not.toHaveProperty('alternates')
    expect(recipeMetadataFromSchema(base, { path: '/recipes/soup' }).alternates).toEqual({
      canonical: '/recipes/soup',
    })
  })

  it('emits nothing for an empty item', () => {
    expect(recipeMetadataFromSchema({ _meta: {} })).toEqual({})
  })
})

describe('recipeJsonLd', () => {
  it('builds a schema.org Recipe from the fields the content holds', () => {
    const ld = recipeJsonLd(full)
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Slow-roast tomato soup',
      description: 'Tomatoes and beans',
      identifier: 'U1234567',
      recipeYield: '4 servings',
      recipeIngredient: ['280g Plum tomatoes', 'Cannellini beans'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Roast the tomatoes.' },
        { '@type': 'HowToStep', text: 'Blend with the beans.' },
      ],
      nutrition: { '@type': 'NutritionInformation', calories: '719 kcal', servingSize: '475 g' },
      dateModified: '2024-11-06',
    })
    expect((ld.image as string[])[0]).toContain('soup')
  })

  it('emits only the type and context for an empty item', () => {
    expect(recipeJsonLd({ _meta: {} })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
    })
  })

  it('never emits allergens or a url — neither is held in a form schema.org can take', () => {
    const ld = recipeJsonLd(full)
    expect(ld).not.toHaveProperty('allergens')
    expect(ld).not.toHaveProperty('url')
  })

  it('omits nutrition when neither portion figure is present', () => {
    expect(recipeJsonLd({ ...base, nutrition: { kcalPer100g: 147 } })).not.toHaveProperty(
      'nutrition',
    )
  })
})
