import { isMediaImageLink, mediaImageUrl } from '@amplience/quadratic-content'
import type { MediaImageLink } from '@amplience/quadratic-content'
import type { ComponentRegistryEntry } from '@amplience/quadratic-types'

import { Page, type PageProps } from './Page'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const PAGE_SCHEMA = 'https://quadratic.amplience.com/v2/content/page'

/**
 * A social-card image: an Amplience media-link (Dynamic Media URL built at
 * mapping time) or a plain `{ src }` object with a ready-made URL — the
 * shape the rest of the fixtures use for images.
 */
export type PageSocialImage = MediaImageLink | { readonly src: string }

/**
 * The social-card group on a page — feeds og:title / og:description /
 * og:image. `title` and `description` fall back to the page's own when the
 * group is present but a field is unset.
 */
export type PageSocialCard = {
  readonly title?: string
  readonly description?: string
  readonly image?: PageSocialImage
}

/**
 * Robots directives on a page. Absent flags mean "indexable, followable" —
 * the safe default; editors opt *out* of indexing, never in.
 */
export type PageRobots = {
  readonly noindex?: boolean
  readonly nofollow?: boolean
}

/**
 * The page delivery body — an ordered list of slots plus page-level
 * metadata. The metadata fields feed the document `<head>` via
 * `pageMetadataFromSchema`; the template renders only the slots.
 */
export type PageSchema = {
  readonly _meta: unknown
  /** Document title — `<title>` / SEO. */
  readonly title?: string
  /** Meta description — search snippets and social previews. */
  readonly description?: string
  /** Meta keywords. Low SEO weight today, but cheap to carry. */
  readonly keywords?: readonly string[]
  /** Social card (Open Graph) overrides. */
  readonly social?: PageSocialCard
  /**
   * Custom canonical URL. Rarely set — when absent, the canonical defaults
   * to the page's own route path (passed by the route via
   * `PageMetadataOptions.path`), which is standard self-referencing-canonical
   * hygiene against query-param and host duplicates.
   */
  readonly canonicalUrl?: string
  /** Robots directives. Absent means indexable and followable. */
  readonly robots?: PageRobots
  readonly slots?: readonly unknown[]
}

/** Route-side context for metadata mapping. */
export type PageMetadataOptions = {
  /**
   * The route path serving this page (e.g. `'/'`, `'/products/sofas'`).
   * Used as the canonical default when the content sets no `canonicalUrl`.
   * Relative paths are resolved against the deployment's `metadataBase`.
   */
  readonly path?: string
}

/**
 * The head-metadata view of a page content item. Field names line up with
 * Next.js's `Metadata` type so a route's `generateMetadata` can return the
 * result directly — but the shape is deliberately framework-free: this
 * package doesn't depend on Next types, and other consumers (a future
 * visualization shell, an RSS builder) can read the same view.
 */
export type PageMetadata = {
  readonly title?: string
  readonly description?: string
  readonly keywords?: string[]
  readonly openGraph?: {
    readonly title?: string
    readonly description?: string
    readonly images?: string[]
  }
  readonly alternates?: { readonly canonical?: string }
  readonly robots?: { readonly index: boolean; readonly follow: boolean }
}

/**
 * Map a page content item to its head metadata.
 *
 * Fields the content doesn't set are *omitted* (not set to undefined) so the
 * result composes cleanly with metadata merging — in Next.js, an omitted
 * field falls back to the layout's site-wide value, which is the behaviour
 * you want for a page that simply doesn't specify a description.
 *
 * Group-level behaviour:
 *  - `openGraph` is emitted only when the content has a `social` group —
 *    without one, social scrapers fall back to `<title>` and the meta
 *    description anyway, so emitting a copy would be noise. Within the
 *    group, unset title/description fall back to the page's own.
 *  - `alternates.canonical` is the content's `canonicalUrl` when set,
 *    otherwise the route path from `opts.path` (self-referencing canonical).
 *  - `robots` is emitted only when the content has a `robots` group; the
 *    site-wide default (indexable) needs no tag.
 */
export const pageMetadataFromSchema = (
  schema: PageSchema,
  opts: PageMetadataOptions = {},
): PageMetadata => {
  const social = schema.social
  const ogTitle = social?.title ?? schema.title
  const ogDescription = social?.description ?? schema.description
  const ogImage =
    social?.image === undefined
      ? undefined
      : isMediaImageLink(social.image)
        ? mediaImageUrl(social.image)
        : social.image.src
  const canonical = schema.canonicalUrl ?? opts.path

  return {
    ...(schema.title !== undefined && { title: schema.title }),
    ...(schema.description !== undefined && { description: schema.description }),
    ...(schema.keywords !== undefined &&
      schema.keywords.length > 0 && { keywords: [...schema.keywords] }),
    ...(social !== undefined && {
      openGraph: {
        ...(ogTitle !== undefined && { title: ogTitle }),
        ...(ogDescription !== undefined && { description: ogDescription }),
        ...(ogImage !== undefined && { images: [ogImage] }),
      },
    }),
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
 * Registry entry for the page schema. A container entry: `getChildren` hands
 * the page's `slots` back to the renderer, which renders them recursively
 * and passes the result in as `children`.
 *
 * Head metadata is deliberately not rendered by the Page template: document
 * `<head>` tags rendered inside the body tree would collide with the
 * deployment's route-level metadata (Next.js renders the layout's `metadata`
 * export into `<head>` already). Routes own the head; they call
 * `pageMetadataFromSchema` from `generateMetadata` instead.
 */
export const pageRegistryEntry: ComponentRegistryEntry<PageSchema, PageProps> = {
  component: Page,
  propsFromSchema: () => ({}),
  getChildren: (schema) => schema.slots ?? [],
}
