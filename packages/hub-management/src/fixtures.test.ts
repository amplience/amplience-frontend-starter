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
    expect(contentTypeSchemas).toHaveLength(21)
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
