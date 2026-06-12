# UI Components Reference

## text

Default for `type: string`. No component name needed.

**Params:**

- `placeholder` — guide text

---

## text-area

Multi-line string input.

**Params:**

- `minRows` — min height in rows
- `maxRows` — max height in rows
- `placeholder` — guide text
- `autosize` — `true` / `false` (default). Grow with content.

```json
"body": {
  "type": "string",
  "title": "Body Text",
  "ui:component": { "name": "text-area", "params": { "minRows": 3, "maxRows": 10, "autosize": "true" } }
}
```

---

## rich-text

Markdown editor. Auto-applied to `format: markdown`. No component name required.

**Params:**

- `defaultView` — `"markdown"` or `"editor"` (default)
- `withMarkdownView` — `true` (default) / `false`
- `withToolbar` — `true` (default) / `false`

```json
"content": { "type": "string", "format": "markdown", "title": "Content" }
```

---

## color

Color picker. Used with `type: string, format: color`.

**Params:**

- `placeholder`
- `format` — `"hex"` (default) or `"RGBA"`
- `colors` — array of color strings (swatches)
- `withPicker` — `true` (default) / `false`
- `withEyeDropper` — `true` (default) / `false`
- `disallowInput` — `true` / `false` (default)

```json
"brandColor": {
  "type": "string",
  "format": "color",
  "title": "Brand Color",
  "ui:component": {
    "name": "color",
    "params": { "format": "hex", "colors": ["#FF0000", "#00FF00", "#0000FF"] }
  }
}
```

---

## switch

Boolean toggle checkbox.

**Params:**

- `labelPosition` — `"left"` or `"right"` (default)

```json
"isActive": {
  "type": "boolean",
  "title": "Active",
  "ui:component": "switch"
}
```

---

## slider

Numeric input via a slider. For `type: integer` or `type: number`.

**Params:**

- `placeholder`
- `defaultValue`
- `inverted` — `true` / `false` (default)
- `marks` — array of `{ value, label }` objects
- `step` — increment amount
- `px` — inline padding: `xs`, `sm`, `md`, `lg`, `xl`

```json
"fontSize": {
  "type": "integer",
  "title": "Font Size",
  "ui:component": {
    "name": "slider",
    "params": {
      "marks": [
        { "value": 0, "label": "xs" },
        { "value": 25, "label": "sm" },
        { "value": 50, "label": "md" },
        { "value": 75, "label": "lg" },
        { "value": 100, "label": "xl" }
      ],
      "step": 25
    }
  }
}
```

---

## none

Invisible component. Use to hide `const` discriminator fields in oneOf palettes.

```json
"type": { "const": "banner", "ui:component": "none" }
```

---

## code-editor

Code/markup input with syntax highlighting.

**Params:**

- `language` — `"html"` (default), `"css"`, `"json"`, `"javascript"`, `"typescript"`, `"jsx"`, `"tsx"`

```json
"customHtml": {
  "type": "string",
  "title": "Custom HTML",
  "ui:component": { "name": "code-editor", "params": { "language": "html" } }
}
```
