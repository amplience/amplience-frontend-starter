/**
 * Fixture ↔ schema drift guard (QL-92).
 *
 * Every base-site fixture body must validate against the schema its
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

import { allFixtures } from '@amplience/quadratic-content/mock'

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
    // Referenced by partials/media (DynamicImage branch, image-poi extension).
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
