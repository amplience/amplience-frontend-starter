/**
 * Fixture ↔ schema drift guard (QL-92).
 *
 * Every frontend-starter fixture body must validate against the schema its
 * `_meta.schema` names. The fixtures are the seed corpus the hub is
 * populated from *and* the mock client's data, so this test is what makes
 * "fixtures and schemas agree" a property CI enforces rather than a thing
 * someone checked once — it runs with no hub credentials (ADR-0012's
 * contributor loop).
 *
 * Amplience's core schema (`http://bigcontent.io/cms/schema/v1/core`) lives
 * in the platform, not on disk, so the test registers a minimal stand-in for
 * the two definitions our schemas reference. The stub keeps the parts that
 * catch real mistakes (a content-link missing its target `id` or
 * `contentType`) and no more — platform-side validation remains the
 * authority on the full core shape.
 */

import Ajv from 'ajv'
import { describe, expect, it } from 'vitest'

import { allFixtures } from '@amplience/frontend-starter-content/mock'

import partialsMedia from '../content-type-schemas/schemas/partials_media.json'
import partialsRichMedia from '../content-type-schemas/schemas/partials_rich-media.json'
import { contentTypeSchemas, findSchema, schemaManifest } from './index'

/** Minimal stand-in for the platform-hosted core schema (see module doc). */
const coreSchemaStub = {
  $id: 'http://bigcontent.io/cms/schema/v1/core',
  definitions: {
    content: { type: 'object' },
    'content-link': {
      type: 'object',
      required: ['id', 'contentType'],
      properties: {
        id: { type: 'string' },
        contentType: { type: 'string' },
      },
    },
    // Referenced by partials/media and partials/rich-media (DynamicImage
    // branch, image-poi extension; DynamicVideo poster).
    // Mirrors the fields the renderer requires to build a DI URL.
    'image-link': {
      type: 'object',
      required: ['name', 'endpoint', 'defaultHost'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        endpoint: { type: 'string' },
        defaultHost: { type: 'string' },
      },
    },
    // Referenced by partials/rich-media (DynamicVideo branch). Same fields a
    // DAM video URL is built from.
    'video-link': {
      type: 'object',
      required: ['name', 'endpoint', 'defaultHost'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        endpoint: { type: 'string' },
        defaultHost: { type: 'string' },
      },
    },
    // Referenced by fields localized with a custom inner value (e.g.
    // markdown-block's `content`, which localizes a `format: markdown` string).
    // A field arrives either as a `{ values, _meta }` object (no locale
    // requested) or as a resolved scalar (locale requested), so accept
    // anything — the schema's own inner `value` override does the real check.
    'localized-value': {},
  },
} as const

/**
 * Minimal stand-in for the platform-hosted hierarchy schema.
 * `hierarchy-node` is referenced by `trait:hierarchy` schemas; the stub
 * accepts any object so AJV can resolve the `$ref` without a network call.
 */
const hierarchySchemaStub = {
  $id: 'http://bigcontent.io/cms/schema/v2/hierarchy',
  definitions: {
    'hierarchy-node': { type: 'object' },
  },
} as const

/**
 * Minimal stand-in for the platform-hosted localization schema. Field-level
 * localized fields (ADR-0015) reference `localized-string`; a field arrives
 * either as a `{ values, _meta }` object (no locale requested) or as a
 * resolved scalar (locale requested), so the stub accepts anything — the
 * platform remains the authority on the full localized shape.
 * (`localized-value` lives on the core schema, not here — see coreSchemaStub.)
 */
const localizationSchemaStub = {
  $id: 'http://bigcontent.io/cms/schema/v1/localization',
  definitions: {
    'localized-string': {},
  },
} as const

const ajv = new Ajv({
  // Schemas carry Amplience vocabulary (`ui:component`, `propertyOrder`)
  // and editor-facing formats (`markdown`) that ajv doesn't know; both are
  // platform concerns, not JSON-Schema validation concerns.
  strict: false,
  validateFormats: false,
  allErrors: true,
})
ajv.addSchema(coreSchemaStub)
ajv.addSchema(hierarchySchemaStub)
ajv.addSchema(localizationSchemaStub)
for (const { schema } of schemaManifest) ajv.addSchema(schema)

describe('schema manifest', () => {
  it('carries a valid draft-07 schema for every entry', () => {
    for (const { schemaId, schema } of schemaManifest) {
      expect(ajv.validateSchema(schema), `schema ${schemaId} is not a valid JSON Schema`).toBe(true)
    }
  })

  it('has a manifest entry for every schema URI the fixtures dispatch on', () => {
    const dispatched = new Set(
      allFixtures().map((f) => (f.body as { _meta: { schema: string } })._meta.schema),
    )
    for (const uri of dispatched) {
      expect(
        findSchema(uri),
        `fixtures dispatch on ${uri} but the manifest has no schema for it`,
      ).toBeDefined()
    }
  })

  it('exposes content types as the non-partial subset', () => {
    // A deliberate tripwire: bump this when a content type is added, so the
    // count is a decision rather than something derived from the thing it
    // checks. 24 as of the carousel (ADR-0020).
    expect(contentTypeSchemas).toHaveLength(24)
    expect(contentTypeSchemas.every((e) => e.validationLevel !== 'PARTIAL')).toBe(true)
    expect(findSchema('https://quadratic.amplience.com/v2/partials/media')?.validationLevel).toBe(
      'PARTIAL',
    )
    expect(
      findSchema('https://quadratic.amplience.com/v2/partials/rich-media')?.validationLevel,
    ).toBe('PARTIAL')
  })
})

describe('every fixture body validates against its schema', () => {
  for (const fixture of allFixtures()) {
    const body = fixture.body as { _meta: { schema: string } }
    const schemaId = body._meta.schema

    it(`${fixture.label} (${schemaId})`, () => {
      const validate = ajv.getSchema(schemaId)
      expect(validate, `no schema registered for ${schemaId}`).toBeDefined()
      const valid = validate?.(body)
      expect(valid, JSON.stringify(validate?.errors ?? [], null, 2)).toBe(true)
    })
  }
})

const CONTENT_LINK_SCHEMA = 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'

type ContentLink = { id: string; contentType: string }

/** Every content-link anywhere in a fixture body, however deeply nested. */
function contentLinksIn(node: unknown, found: ContentLink[] = []): ContentLink[] {
  if (Array.isArray(node)) {
    for (const child of node) contentLinksIn(child, found)
    return found
  }
  if (typeof node !== 'object' || node === null) return found
  const { _meta, id, contentType, ...rest } = node as {
    _meta?: { schema?: string }
    id?: unknown
    contentType?: unknown
  } & Record<string, unknown>
  if (
    _meta?.schema === CONTENT_LINK_SCHEMA &&
    typeof id === 'string' &&
    typeof contentType === 'string'
  ) {
    found.push({ id, contentType })
  }
  for (const value of Object.values(rest)) contentLinksIn(value, found)
  return found
}

/**
 * A content-link carries the target's schema URI alongside its id, and the two
 * have to agree — the platform validates the link against the allowed-type enum
 * on that field, so a link claiming `grid` while pointing at a carousel is
 * invalid content even though the mock resolver (which goes by id) renders it
 * happily. That divergence is invisible until a hub import rejects it, and it is
 * exactly what happens when a fixture's container type is changed without
 * revisiting the links into it.
 *
 * Links whose target isn't in the fixture set are skipped rather than failed:
 * an unresolvable link is a deliberate case elsewhere (the mock client has a
 * test for leaving one unresolved), and this guard is about agreement, not
 * completeness.
 */
describe('every content-link names its target’s actual content type', () => {
  const schemaById = new Map(
    allFixtures().map((f) => [f.id, (f.body as { _meta: { schema: string } })._meta.schema]),
  )

  for (const fixture of allFixtures()) {
    const links = contentLinksIn(fixture.body)
    if (links.length === 0) continue

    it(`${fixture.label} (${links.length} link${links.length === 1 ? '' : 's'})`, () => {
      for (const link of links) {
        const actual = schemaById.get(link.id)
        if (actual === undefined) continue
        expect(
          link.contentType,
          `link to ${link.id} says "${link.contentType}" but that item is "${actual}"`,
        ).toBe(actual)
      }
    })
  }
})

/**
 * The media partials' branch rules — the fixtures only exercise the happy
 * paths, so these pin down what each `mediaType` requires and what the two
 * partials accept. partials/media stays image-only; partials/rich-media adds
 * the two video branches on top of the same image definitions.
 */
describe('media partials', () => {
  const MEDIA = 'https://quadratic.amplience.com/v2/partials/media'
  const RICH_MEDIA = 'https://quadratic.amplience.com/v2/partials/rich-media'
  const damLink = { name: 'clip', endpoint: 'demo', defaultHost: 'cdn.media.amplience.net' }
  const dynamicImage = { mediaType: 'DynamicImage', image: { image: damLink } }
  const manualImage = {
    mediaType: 'ManualImage',
    image: { src: 'https://example.com/a.jpg', alt: 'A', width: 800, height: 600 },
  }
  const dynamicVideo = { mediaType: 'DynamicVideo', video: damLink, playback: 'ambient' }
  const externalVideo = {
    mediaType: 'ExternalVideo',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Product walkthrough',
  }

  const validates = (schemaId: string, body: unknown) => ajv.getSchema(schemaId)?.(body) === true

  it('partials/media accepts both image types and rejects video', () => {
    expect(validates(MEDIA, dynamicImage)).toBe(true)
    expect(validates(MEDIA, manualImage)).toBe(true)
    expect(validates(MEDIA, dynamicVideo)).toBe(false)
    expect(validates(MEDIA, externalVideo)).toBe(false)
  })

  it('partials/rich-media accepts all four media types', () => {
    for (const body of [dynamicImage, manualImage, dynamicVideo, externalVideo]) {
      expect(validates(RICH_MEDIA, body), body.mediaType).toBe(true)
    }
  })

  it('still enforces the ManualImage required fields in partials/rich-media', () => {
    expect(validates(RICH_MEDIA, { mediaType: 'ManualImage', image: { src: '/a.jpg' } })).toBe(
      false,
    )
  })

  it('requires a video on DynamicVideo', () => {
    expect(validates(RICH_MEDIA, { mediaType: 'DynamicVideo' })).toBe(false)
  })

  it('requires a url and a title on ExternalVideo', () => {
    expect(validates(RICH_MEDIA, { ...externalVideo, title: undefined })).toBe(false)
    expect(validates(RICH_MEDIA, { mediaType: 'ExternalVideo', title: 'x' })).toBe(false)
  })

  it('requires an https poster URL', () => {
    expect(validates(RICH_MEDIA, { ...externalVideo, posterUrl: 'http://x.com/p.jpg' })).toBe(false)
  })

  it('rejects an unknown playback mode or aspect ratio', () => {
    expect(validates(RICH_MEDIA, { ...dynamicVideo, playback: 'autoplay' })).toBe(false)
    expect(validates(RICH_MEDIA, { ...dynamicVideo, aspectRatio: '3:2' })).toBe(false)
  })

  // rich-media is an object content palette (the DC editor doesn't support
  // several if/then branches); its image options copy partials/media's fields.
  it('carries image options identical to partials/media', () => {
    const option = (mediaType: string) => {
      const found = partialsRichMedia.oneOf.find((o) => o.properties.mediaType.const === mediaType)
      const { mediaType: _discriminator, ...fields } = found?.properties ?? {}
      return fields
    }
    expect(option('DynamicImage')).toEqual(partialsMedia.then.properties)
    expect(option('ManualImage')).toEqual(partialsMedia.else.properties)
  })

  it('gives every palette option a unique, hidden mediaType const', () => {
    const consts = partialsRichMedia.oneOf.map((o) => o.properties.mediaType)
    expect(new Set(consts.map((c) => c.const)).size).toBe(consts.length)
    expect(consts.every((c) => c['ui:component'] === 'none')).toBe(true)
  })

  it('rejects a body with no mediaType', () => {
    expect(validates(RICH_MEDIA, { image: manualImage.image })).toBe(false)
  })

  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/76979871',
    'https://player.vimeo.com/video/76979871',
    'https://cdn.example.com/media/loop.mp4',
    'https://cdn.example.com/media/loop.mp4?v=2',
    'https://cdn.example.com/media/LOOP.MP4',
    'https://vimeo.com/showcase/123/video/456',
  ])('accepts the external video URL %s', (url) => {
    expect(validates(RICH_MEDIA, { ...externalVideo, url })).toBe(true)
  })

  it.each([
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/video',
    'https://example.com/clip.mov',
    'https://example.com/?file=clip.mp4',
    'https://www.youtube.com/',
    'https://www.youtube.com/@amplience',
    'https://www.youtube.com/playlist?list=PL123',
    'https://vimeo.com/channels/staffpicks',
  ])('rejects the external video URL %s', (url) => {
    expect(validates(RICH_MEDIA, { ...externalVideo, url })).toBe(false)
  })
})

describe('block CSS (ADR-0026)', () => {
  const PARTIAL = 'https://quadratic.amplience.com/v2/partials/block-css'
  const REF = `${PARTIAL}#/definitions/css`

  /**
   * The content types offering `customCss`. A deliberate tripwire, like the
   * content-type count above: adding the field to another block is a decision,
   * and that block's component must pass `className` to its root (checked in
   * apps/web/src/renderer/dispatch.block-css.test.tsx — keep the two in step).
   */
  const BLOCKS = [
    'https://quadratic.amplience.com/v2/content/carousel',
    'https://quadratic.amplience.com/v2/content/columns',
    'https://quadratic.amplience.com/v2/content/grid',
    'https://quadratic.amplience.com/v2/content/hero',
    'https://quadratic.amplience.com/v2/content/markdown-block',
    'https://quadratic.amplience.com/v2/content/media',
    'https://quadratic.amplience.com/v2/content/media-card',
  ]

  type Tab = { label: string; pointers: string[] }
  type BlockSchema = {
    properties: Record<string, Record<string, unknown>>
    propertyOrder?: string[]
    'ui:component'?: { params: { tabs: { items: Tab[] } } }
  }
  const schemaOf = (id: string) => findSchema(id)?.schema as unknown as BlockSchema

  it('registers the partial', () => {
    expect(findSchema(PARTIAL)?.validationLevel).toBe('PARTIAL')
  })

  it('caps the value at the renderer limit', () => {
    // Must equal BLOCK_CSS_MAX_LENGTH in apps/web/src/renderer/block-css.ts —
    // the schema stops the editor saving what the renderer would reject.
    const partial = findSchema(PARTIAL)?.schema as {
      definitions: { css: { maxLength: number } }
    }
    expect(partial.definitions.css.maxLength).toBe(4000)
  })

  it('is offered by exactly the expected blocks', () => {
    const offering = contentTypeSchemas
      .filter((e) => 'customCss' in ((e.schema as unknown as BlockSchema).properties ?? {}))
      .map((e) => e.schemaId)
      .sort()
    expect(offering).toEqual([...BLOCKS].sort())
  })

  it('uses one identical property definition everywhere', () => {
    // The title, description and ui:extension are copied per block rather than
    // living in the partial (see its description), so hold the copies together.
    const [first, ...rest] = BLOCKS.map((id) => schemaOf(id).properties.customCss)
    expect(first).toMatchObject({
      type: 'string',
      'ui:extension': { name: 'css-editor' },
      allOf: [{ $ref: REF }],
    })
    for (const prop of rest) expect(prop).toEqual(first)
  })

  it.each(BLOCKS)('%s lists the field last — tucked away at the end of its tab', (id) => {
    const schema = schemaOf(id)
    if (schema.propertyOrder !== undefined) expect(schema.propertyOrder.at(-1)).toBe('customCss')
    const tabs = schema['ui:component']?.params.tabs.items
    if (tabs !== undefined) {
      const holding = tabs.filter((t) => t.pointers.includes('/customCss'))
      expect(holding).toHaveLength(1)
      expect(holding[0]?.pointers.at(-1)).toBe('/customCss')
    }
  })

  it('validates a body with CSS, and rejects one over the cap', () => {
    const validate = ajv.getSchema('https://quadratic.amplience.com/v2/content/markdown-block')
    const body = { _meta: { schema: 'x' }, content: 'Hello' }
    expect(validate?.({ ...body, customCss: 'h2 { color: red; }' })).toBe(true)
    expect(validate?.({ ...body, customCss: 'x'.repeat(4001) })).toBe(false)
  })
})
