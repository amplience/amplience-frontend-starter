# Layout Components Reference

## tabs

Groups fields into navigable tabs. Applied to `type: object`.

**Params:**

- `defaultTab` — name of initially selected tab
- `orientation` — `"horizontal"` (default) / `"vertical"`
- `variant` — `"default"` or `"outline"`
- `grow` — `true` / `false` (default)
- `items` — array of `{ label, pointers[] }` where pointers are JSON pointer paths

```json
{
  "type": "object",
  "ui:component": {
    "name": "tabs",
    "params": {
      "tabs": {
        "defaultTab": "Content",
        "items": [
          { "label": "Content", "pointers": ["/title", "/body", "/image"] },
          { "label": "SEO", "pointers": ["/metaTitle", "/metaDescription"] },
          { "label": "Styles", "pointers": ["/backgroundColor", "/textColor"] }
        ]
      }
    }
  },
  "properties": {
    "title": { "type": "string", "title": "Title" },
    "body": { "type": "string", "format": "markdown", "title": "Body" },
    "image": {
      "title": "Image",
      "allOf": [{ "$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/image-link" }]
    },
    "metaTitle": { "type": "string", "title": "Meta Title", "maxLength": 60 },
    "metaDescription": { "type": "string", "title": "Meta Description", "maxLength": 160 },
    "backgroundColor": { "type": "string", "format": "color", "title": "Background Color" },
    "textColor": { "type": "string", "format": "color", "title": "Text Color" }
  }
}
```

---

## grid

Multi-column layout for properties. Applied to `type: object`.

**Params:**

- `numColumns` — total columns (recommend 12 for flexibility)
- `columns` — array of `{ span, pointers[] }`

```json
{
  "type": "object",
  "ui:component": {
    "name": "grid",
    "params": {
      "numColumns": 12,
      "columns": [
        { "span": 6, "pointers": ["/image", "/isSVG"] },
        { "span": 6, "pointers": ["/altText", "/imageUrl", "/target"] }
      ]
    }
  },
  "properties": { ... }
}
```

---

## fieldset

Grouped fields with a border/fill style. Applied to `type: object`.

**Params:**

- `variant` — `"default"` (rounded border), `"filled"` (background fill), `"unstyled"` (title only)
- `radius` — `"xs"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"xxl"`

```json
{
  "title": "CTA",
  "type": "object",
  "ui:component": { "name": "fieldset", "params": { "variant": "default" } },
  "properties": {
    "label": { "type": "string", "title": "Button Label" },
    "url": { "type": "string", "format": "uri", "title": "URL" },
    "target": {
      "type": "string",
      "title": "Target",
      "oneOf": [
        { "const": "_blank", "title": "New Tab" },
        { "const": "_self", "title": "Same Tab" }
      ]
    }
  }
}
```

---

## fieldset-grid

Combines fieldset styling with grid column layout. Applied to `type: object`.

**Params:**

- `variant` — `"default"` or `"filled"`
- `numColumns` — total grid columns
- `columns` — array of `{ span, pointers[] }`

```json
{
  "title": "Media",
  "type": "object",
  "ui:component": {
    "name": "fieldset-grid",
    "params": {
      "variant": "filled",
      "numColumns": 12,
      "columns": [
        { "span": 6, "pointers": ["/image"] },
        { "span": 6, "pointers": ["/altText", "/caption"] }
      ]
    }
  },
  "properties": { ... }
}
```

---

## divider

Visual separator with optional label. Applied to a `type: string` property (value is unused).

**Params:**

- `label` — text shown on the divider
- `labelPosition` — `"left"`, `"right"`, `"center"` (default)
- `size` — `"xs"` (default), `"sm"`, `"md"`, `"lg"`, `"xl"`, `"xxl"`
- `variant` — `"dotted"`, `"dashed"`, or solid (default)

```json
"_seoSeparator": {
  "type": "string",
  "ui:component": { "name": "divider", "params": { "label": "SEO Settings", "size": "sm" } }
}
```

---

## matrix

Table layout for arrays of objects. Columns map to scalar or media properties.

**Restrictions:** Cannot use content-links, content-references, objects, localized values, or extensions as columns.

**Params:**

- `columns` — array of `{ pointer, title?, width? }` (min width 140px; max row height 175px)

```json
{
  "type": "array",
  "title": "FAQ",
  "ui:component": {
    "name": "matrix",
    "params": {
      "columns": [
        { "pointer": "/question", "title": "Question", "width": 300 },
        { "pointer": "/answer", "title": "Answer" }
      ]
    }
  },
  "items": {
    "type": "object",
    "properties": {
      "question": {
        "type": "string",
        "ui:component": { "name": "text-area", "params": { "maxRows": 2, "autosize": "true" } }
      },
      "answer": {
        "type": "string",
        "ui:component": { "name": "text-area", "params": { "maxRows": 2, "autosize": "true" } }
      }
    }
  }
}
```
