import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { BlogArticle, type BlogArticleProps } from './BlogArticle'

/** The schema URI this entry dispatches on (ADR-0010 §3 — no aliasing). */
export const BLOG_ARTICLE_SCHEMA = 'https://quadratic.amplience.com/v2/content/blog-article'

/**
 * The blog-article delivery body — editorial metadata plus an ordered list of
 * slots. The metadata fields feed the document `<head>` via
 * `blogArticleMetadataFromSchema`; the template renders only the cover image,
 * header, and slots.
 */
export type BlogArticleSchema = {
  readonly _meta: unknown
  readonly title?: string
  readonly description?: string
  readonly keywords?: readonly string[]
  readonly social?: {
    readonly title?: string
    readonly description?: string
    readonly image?: { readonly src: string }
  }
  readonly canonicalUrl?: string
  readonly robots?: { readonly noindex?: boolean; readonly nofollow?: boolean }
  readonly coverImage?: {
    readonly src: string
    readonly alt: string
    readonly width: number
    readonly height: number
  }
  readonly author?: string
  readonly publishDate?: string
  readonly category?: string
  readonly tags?: readonly string[]
  readonly readTime?: number
  readonly slots?: readonly unknown[]
}

/**
 * Map a blog-article content item to head metadata — same shape as
 * `pageMetadataFromSchema` so a route's `generateMetadata` can return the
 * result directly.
 */
export const blogArticleMetadataFromSchema = (
  schema: BlogArticleSchema,
  opts: { readonly path?: string } = {},
) => {
  const social = schema.social
  const ogTitle = social?.title ?? schema.title
  const ogDescription = social?.description ?? schema.description
  const ogImage = social?.image?.src ?? schema.coverImage?.src
  const canonical = schema.canonicalUrl ?? opts.path

  return {
    ...(schema.title !== undefined && { title: schema.title }),
    ...(schema.description !== undefined && { description: schema.description }),
    ...(schema.keywords !== undefined &&
      schema.keywords.length > 0 && { keywords: [...schema.keywords] }),
    ...(social !== undefined || schema.coverImage !== undefined
      ? {
          openGraph: {
            ...(ogTitle !== undefined && { title: ogTitle }),
            ...(ogDescription !== undefined && { description: ogDescription }),
            ...(ogImage !== undefined && { images: [ogImage] }),
          },
        }
      : {}),
    ...(canonical !== undefined && { alternates: { canonical } }),
    ...(schema.robots !== undefined && {
      robots: {
        index: !(schema.robots.noindex ?? false),
        follow: !(schema.robots.nofollow ?? false),
      },
    }),
  }
}

/**
 * Registry entry for the blog-article schema. A container entry: `getChildren`
 * hands the article's `slots` back to the renderer, which renders them
 * recursively and passes the result in as `children`.
 */
export const blogArticleRegistryEntry: ComponentRegistryEntry<BlogArticleSchema, BlogArticleProps> =
  {
    component: BlogArticle,
    propsFromSchema: (schema) => ({
      ...(schema.title !== undefined && { title: schema.title }),
      ...(schema.coverImage !== undefined && { coverImage: schema.coverImage }),
      ...(schema.author !== undefined && { author: schema.author }),
      ...(schema.publishDate !== undefined && { publishDate: schema.publishDate }),
      ...(schema.category !== undefined && { category: schema.category }),
      ...(schema.tags !== undefined && { tags: schema.tags }),
      ...(schema.readTime !== undefined && { readTime: schema.readTime }),
    }),
    getChildren: (schema) => schema.slots ?? [],
  }
