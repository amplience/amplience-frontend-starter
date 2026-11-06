/**
 * Blog-article fixtures for stories — the real articles from the
 * `frontend-starter` and `anyafinn` fixture sets, normalised to the
 * `BlogArticlePage` props, so the stories show what a seeded site shows.
 *
 * Each body is narrowed rather than cast, so a fixture that drops a field
 * drops it here too instead of faking it.
 */

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import grownUpGlitter from '../../../content/fixtures/anyafinn/pages/blog/grown-up-glitter.json'
import opulentDecadence from '../../../content/fixtures/anyafinn/pages/blog/opulent-decadence.json'
import piratecore from '../../../content/fixtures/anyafinn/pages/blog/piratecore.json'
import contentModelling from '../../../content/fixtures/frontend-starter/pages/blog/content-modelling.json'
import gettingStarted from '../../../content/fixtures/frontend-starter/pages/blog/getting-started.json'
import quadraticAccelerator from '../../../content/fixtures/frontend-starter/pages/blog/quadratic-accelerator.json'

/** The template's props, minus the renderer-supplied ones. */
export type StoryBlogArticle = {
  readonly slug: string
  readonly title?: string
  readonly coverImage?: ContentMediaData
  readonly author?: string
  readonly publishDate?: string
  readonly category?: string
  readonly tags?: readonly string[]
  readonly readTime?: number
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)

const toStoryArticle = (fixture: unknown): StoryBlogArticle => {
  const body = (fixture as { body: Record<string, unknown> }).body
  const key = (body._meta as { deliveryKeys?: { values?: { value: string }[] } } | undefined)
    ?.deliveryKeys?.values?.[0]?.value
  const title = str(body.title)
  const author = str(body.author)
  const publishDate = str(body.publishDate)
  const category = str(body.category)
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string')
    : undefined
  // Some fixtures hold the read time as a number, some as a numeric string.
  const readTime = Number(body.readTime)
  const cover = body.coverImage as { mediaType?: unknown } | undefined
  return {
    slug: key?.split('/').pop() ?? '',
    ...(title !== undefined && { title }),
    // The media partial's delivery shape is exactly `ContentMediaData`; the
    // cast is only because a JSON import widens `mediaType` to `string`.
    ...(typeof cover?.mediaType === 'string' && { coverImage: cover as ContentMediaData }),
    ...(author !== undefined && { author }),
    ...(publishDate !== undefined && { publishDate }),
    ...(category !== undefined && { category }),
    ...(tags !== undefined && tags.length > 0 && { tags }),
    ...(Number.isFinite(readTime) && readTime > 0 && { readTime }),
  }
}

export const storyBlogArticles: readonly StoryBlogArticle[] = [
  gettingStarted,
  contentModelling,
  quadraticAccelerator,
  grownUpGlitter,
  opulentDecadence,
  piratecore,
].map(toStoryArticle)

/** One fixture article by slug. Throws loudly rather than rendering an empty story. */
export const storyBlogArticle = (slug: string): StoryBlogArticle => {
  const found = storyBlogArticles.find((a) => a.slug === slug)
  if (!found) throw new Error(`No blog-article fixture with slug "${slug}"`)
  return found
}
