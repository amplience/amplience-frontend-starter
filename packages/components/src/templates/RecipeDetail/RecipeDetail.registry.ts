import type {
  AmplienceImageLink,
  ComponentRegistryEntry,
  ContentMediaData,
} from '@amplience/frontend-starter-types'

import { contentMediaUrl } from '../../molecules/DynamicImage/di-utils'
import { RecipeDetail, type RecipeDetailProps } from './RecipeDetail'
import type { RecipeIngredient, RecipeNutrition } from './RecipeDetail'

/** The schema URI this entry dispatches on (ADR-0010 §3 — no aliasing). */
export const RECIPE_SCHEMA = 'https://quadratic.amplience.com/v2/content/recipe'

/**
 * The same recipe shape under the Amplience demo-schema host.
 *
 * Recipe content was first modelled and populated (by a Workforce flow) under
 * this URI before the schema moved into this package. Dispatch is an exact URI
 * match, so existing items only render if the same entry is registered under
 * it too. This is explicit composition — two keys, one entry — not aliasing in
 * the dispatcher.
 *
 * Temporary: remove once those items have been recreated under
 * `RECIPE_SCHEMA`.
 */
export const RECIPE_DEMO_SCHEMA = 'https://schema.amplience-demo.net/recipe.json'

/**
 * The recipe delivery body. Field names and shapes mirror the schema exactly —
 * notably `heroImage` is a bare DAM `image-link` (not the `media` partial),
 * which the adapter wraps as a `DynamicImage` for the shared image components.
 */
export type RecipeSchema = {
  readonly _meta: unknown
  readonly recipeId?: string
  readonly title?: string
  readonly slug?: string
  readonly subtitle?: string
  readonly serves?: number
  readonly heroImage?: AmplienceImageLink
  readonly heroAltText?: string
  readonly imageIsAiEnhanced?: boolean
  readonly copy?: {
    readonly intro?: string
    readonly cardBlurb?: string
    readonly menuLine?: string
  }
  readonly ingredients?: readonly RecipeIngredient[]
  readonly preparation?: string
  readonly methodSteps?: readonly string[]
  readonly methodNotes?: string
  readonly allergens?: readonly string[]
  readonly nutrition?: RecipeNutrition
  readonly seo?: { readonly metaTitle?: string; readonly metaDescription?: string }
  readonly recipePdfUrl?: string
  readonly source?: { readonly origin?: string; readonly sourceLastModified?: string }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** Wrap the bare DAM link as the media shape the image components take. */
const heroMedia = (schema: RecipeSchema): ContentMediaData | undefined => {
  const link = schema.heroImage
  if (link?.name === undefined || link.endpoint === undefined || link.defaultHost === undefined) {
    return undefined
  }
  return {
    mediaType: 'DynamicImage',
    image: { image: link },
    ...(schema.heroAltText !== undefined && { imageAltText: schema.heroAltText }),
  }
}

/**
 * Map a recipe content item to head metadata — same shape as
 * `pageMetadataFromSchema`, so a route's `generateMetadata` can return the
 * result directly. `<title>` falls back to the recipe name and the description
 * to the chef's summary, so an author who skips the SEO group still gets
 * sensible tags.
 */
export const recipeMetadataFromSchema = (
  schema: RecipeSchema,
  opts: { readonly path?: string } = {},
) => {
  const title = schema.seo?.metaTitle ?? schema.title
  const description = schema.seo?.metaDescription ?? schema.subtitle
  const media = heroMedia(schema)
  // Cap DI variants at 1200px (the Open Graph recommended width).
  const ogImage = media === undefined ? undefined : contentMediaUrl(media, { width: 1200 })

  return {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(title !== undefined || description !== undefined || ogImage !== undefined
      ? {
          openGraph: {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(ogImage !== undefined && { images: [ogImage] }),
          },
        }
      : {}),
    ...(opts.path !== undefined && { alternates: { canonical: opts.path } }),
  }
}

/**
 * schema.org `Recipe` structured data for the item.
 *
 * Only fields the content genuinely holds are emitted; nothing is inferred.
 * Allergens have no schema.org property and are deliberately left out rather
 * than shoe-horned into one. `url` is omitted because a recipe item has no
 * canonical address of its own — the hosting route knows it, this doesn't.
 */
export const recipeJsonLd = (schema: RecipeSchema): Record<string, unknown> => {
  const media = heroMedia(schema)
  const image = media === undefined ? undefined : contentMediaUrl(media, { width: 1200 })
  const description = schema.seo?.metaDescription ?? schema.subtitle
  const ingredients = (schema.ingredients ?? [])
    .map((i) => [i.quantity, i.name].filter((part) => part !== undefined && part !== '').join(' '))
    .filter((line) => line !== '')
  const steps = (schema.methodSteps ?? []).filter((s) => s !== '')
  const n = schema.nutrition
  const nutrition = {
    ...(n?.portionKcal !== undefined && { calories: `${n.portionKcal} kcal` }),
    ...(n?.portionWeightG !== undefined && { servingSize: `${n.portionWeightG} g` }),
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    ...(schema.title !== undefined && { name: schema.title }),
    ...(description !== undefined && { description }),
    ...(image !== undefined && { image: [image] }),
    ...(schema.recipeId !== undefined && { identifier: schema.recipeId }),
    ...(schema.serves !== undefined && { recipeYield: `${schema.serves} servings` }),
    ...(ingredients.length > 0 && { recipeIngredient: ingredients }),
    ...(steps.length > 0 && {
      recipeInstructions: steps.map((text) => ({ '@type': 'HowToStep', text })),
    }),
    ...(Object.keys(nutrition).length > 0 && {
      nutrition: { '@type': 'NutritionInformation', ...nutrition },
    }),
    ...(schema.source?.sourceLastModified !== undefined && {
      dateModified: schema.source.sourceLastModified,
    }),
  }
}

/**
 * Registry entry for the recipe schema. A leaf: the whole recipe lives in one
 * item, so there are no slots to recurse into. The hero image is the page's
 * leading media, so the render context's `loadPriority` goes to it.
 */
export const recipeRegistryEntry: ComponentRegistryEntry<RecipeSchema, RecipeDetailProps> = {
  component: RecipeDetail,
  propsFromSchema: (schema, ctx) => {
    const media = heroMedia(schema)
    return {
      // A recipe with no title is a content error the schema already forbids;
      // an empty heading is a more legible failure than a crash.
      title: schema.title ?? '',
      loadPriority: ctx.loadPriority ?? 'lazy',
      jsonLd: recipeJsonLd(schema),
      ...(ctx.localeBasePath !== undefined && { localeBasePath: ctx.localeBasePath }),
      ...(schema.subtitle !== undefined && { subtitle: schema.subtitle }),
      ...(schema.serves !== undefined && { serves: schema.serves }),
      ...(media !== undefined && { heroImage: media }),
      ...(schema.imageIsAiEnhanced !== undefined && {
        imageIsAiEnhanced: schema.imageIsAiEnhanced,
      }),
      ...(schema.copy?.intro !== undefined && { intro: schema.copy.intro }),
      ...(schema.ingredients !== undefined && { ingredients: schema.ingredients }),
      ...(schema.preparation !== undefined && { preparation: schema.preparation }),
      ...(schema.methodSteps !== undefined && { methodSteps: schema.methodSteps }),
      ...(schema.methodNotes !== undefined && { methodNotes: schema.methodNotes }),
      ...(schema.allergens !== undefined && { allergens: schema.allergens }),
      ...(schema.nutrition !== undefined && { nutrition: schema.nutrition }),
      ...(schema.recipePdfUrl !== undefined && { recipePdfUrl: schema.recipePdfUrl }),
    }
  },
}
