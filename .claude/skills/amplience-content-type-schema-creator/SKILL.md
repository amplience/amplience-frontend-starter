---
name: amplience-content-type-schema-creator
description: >
  Creates Amplience Content Type JSON schemas following the Amplience Meta Schema (v2) and Core Schema
  conventions. Use this skill whenever the user asks to create, generate, design, or write an Amplience
  Content Type, schema, or partial schema. Also triggers for requests involving Amplience content modelling,
  CMS schema design, or building reusable Amplience components. Always use this skill for any Amplience
  schema work — even for simple types or small additions.
---

# Amplience Content Type Schema Creator

Generates valid Amplience Content Type JSON schemas. Output should be one or more `.json` files, with each file containing **JSON only** — no prose, no markdown fences.

## Before You Start: Check For Existing Schemas

Before generating any new schema, you **must** establish whether the user has existing Amplience Content Type schemas that should inform the new work (for conventions, partials to `$ref`, naming patterns, `$id` host, shared traits, etc.).

1. If the user has not already mentioned existing schemas in their request, **ask them**:
   - Do they have any existing Amplience Content Type schemas they would like to use or align with?
   - If yes, are those schemas available **locally in this workspace** (and where), or are they only hosted remotely / in Amplience?
2. If the schemas are available locally, locate and read the relevant files before drafting. Reuse existing partials via `$ref` rather than duplicating shapes, and match the existing `$id` host, naming style, and conventions.
3. If the schemas exist only remotely, ask the user to paste the relevant schema(s) or provide URLs you can fetch. If neither is possible, proceed but flag any assumptions you have made.
4. If the user confirms they have **no** existing schemas, proceed using the defaults in this skill.

Skip this step only when the user has already supplied existing schemas or has explicitly stated there are none.

## Core Rules

- **Never** use the `additionalProperties` keyword
- **Never** include `_meta` fields in any schema
- Base `$schema`: `http://json-schema.org/draft-07/schema#`
- Use `$id` URIs that follow the pattern: `https://schemas.amplience.com/{name}`
- Root schema must be `type: object` with a `properties` block
- Use `required` arrays to mark mandatory fields
- Think about **reuse**: if a section would be useful in multiple schemas, extract it as a separate partial schema and reference it via `$ref`
- Use `content-link` for inline embedded content; use `content-reference` for references to shared/reusable content items

---

## Schema Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://schemas.amplience.com/{name}",
  "title": "Human Readable Title",
  "description": "What this content type represents",
  "allOf": [{ "$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content" }],
  "type": "object",
  "properties": { ... },
  "propertyOrder": [...],
  "required": [...]
}
```

---

## Core Type References

Always import from `http://bigcontent.io/cms/schema/v1/core#/definitions/`:

| Type                | Usage                                |
| ------------------- | ------------------------------------ |
| `image-link`        | Image asset picker                   |
| `video-link`        | Video asset picker                   |
| `content-link`      | Inline embedded content item         |
| `content-reference` | Reference to a reusable content item |
| `localized-value`   | Locale-aware field wrapper           |

**Image example:**

```json
"image": {
  "title": "Image",
  "allOf": [{ "$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/image-link" }]
}
```

**Content reference (restrict by type):**

```json
{
  "type": "object",
  "title": "Referenced Content",
  "allOf": [
    { "$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference" },
    { "properties": { "contentType": { "enum": ["https://your-schema-uri"] } } }
  ]
}
```

---

## Field Types

| Need                 | JSON Schema                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| Short text           | `{ "type": "string", "maxLength": 100 }`                                |
| Long text            | `{ "type": "string", "ui:component": "text-area" }`                     |
| Rich text / Markdown | `{ "type": "string", "format": "markdown" }`                            |
| Boolean toggle       | `{ "type": "boolean" }`                                                 |
| Integer              | `{ "type": "integer" }`                                                 |
| Number               | `{ "type": "number" }`                                                  |
| Date/time            | `{ "type": "string", "format": "date-time" }`                           |
| Color                | `{ "type": "string", "format": "color" }`                               |
| URL                  | `{ "type": "string", "format": "uri" }`                                 |
| Enum dropdown        | `{ "type": "string", "oneOf": [{ "const": "val", "title": "Label" }] }` |

---

## UI Components

Read `references/ui-components.md` for full component documentation.

**Quick reference:**

| Component     | Use case                                         |
| ------------- | ------------------------------------------------ |
| `text-area`   | Multi-line text input                            |
| `rich-text`   | Markdown editor                                  |
| `color`       | Color picker                                     |
| `switch`      | Boolean toggle                                   |
| `slider`      | Numeric range input                              |
| `none`        | Hide a field (useful for `const` discriminators) |
| `code-editor` | Code/HTML input                                  |

**Shorthand:**

```json
"myField": { "type": "string", "ui:component": "text-area" }
```

**With params:**

```json
"myField": {
  "type": "string",
  "ui:component": { "name": "text-area", "params": { "minRows": 2, "maxRows": 5 } }
}
```

---

## Layout Components

Read `references/layout-components.md` for full layout documentation with examples.

**Quick reference:**

| Component       | Use case                             |
| --------------- | ------------------------------------ |
| `tabs`          | Organise fields into named tabs      |
| `grid`          | Multi-column field layout            |
| `fieldset`      | Bordered/filled group of fields      |
| `fieldset-grid` | Fieldset + grid combined             |
| `divider`       | Visual separator with optional label |
| `matrix`        | Table of rows with typed columns     |

Layout components are applied via `ui:component` on the parent `object`.

---

## Content Palette (oneOf Array)

Use for arrays where editors can choose from multiple content types. See `references/content-palette.md` for a full worked example.

Pattern:

```json
"items": {
  "oneOf": [
    {
      "type": "object",
      "title": "VariantName",
      "properties": {
        "type": { "const": "variant-name", "ui:component": "none" },
        ...
      },
      "required": ["type"]
    }
  ]
}
```

Set icons per variant via the array's `ui:component.params.icons` object, keyed by the `type` const value.

---

## Conditionals

Use `if/then/else` to show/hide fields or change validation based on another field's value.

```json
{
  "type": "object",
  "properties": {
    "showPromo": { "type": "boolean", "title": "Show Promotion?" }
  },
  "if": { "properties": { "showPromo": { "const": true } } },
  "then": {
    "properties": {
      "promoText": { "type": "string", "title": "Promo Text" }
    }
  }
}
```

> ⚠️ `if/then/else` blocks **cannot** be directly nested within each other.

---

## Traits

### Sortable

```json
"trait:sortable": {
  "sortBy": [{ "key": "title", "paths": ["/title"] }]
}
```

### Filterable

```json
"trait:filterable": {
  "filterBy": [{ "paths": ["/category"] }]
}
```

### Hierarchy (parent/child content types)

```json
"trait:hierarchy": {
  "childContentTypes": ["https://your-child-schema-uri"]
}
```

---

## Reuse Strategy

Before generating a monolithic schema, ask: **could any section be a standalone partial?**

Good candidates for partials:

- SEO metadata block (title, description, canonical URL)
- CTA (call-to-action) with link + label + target
- Image with alt text and href
- Author/byline block
- Address block

Reference a partial from another schema:

```json
"seo": { "$ref": "https://schemas.amplience.com/seo-partial" }
```

---

## Output Format

- Return one or more `.json` files, with exactly one schema object per file
- Name each file from the schema name / `$id` suffix using kebab-case, for example `https://schemas.amplience.com/seo-partial` -> `seo-partial.json`
- Each file must contain **pure JSON** — no markdown, no commentary, no explanation
- Partial schemas should omit the `allOf` content root reference
- Order properties logically using `propertyOrder`
