# Content Palette Reference

A content palette is an array where editors can choose from multiple distinct content variants, each with its own set of fields. Each variant is discriminated by a hidden `type` const field.

> ⚠️ Content palette fields do **not** require the `name` field setting as it will be auto-detected as an `array` component.

## Structure

```json
{
  "type": "array",
  "title": "Page Sections",
  "ui:component": {
    "params": {
      "icons": {
        "variant-const-value": "icon-name"
      }
    }
  },
  "items": {
    "oneOf": [
      {
        "type": "object",
        "title": "Variant Display Name",
        "properties": {
          "type": { "const": "variant-const-value", "ui:component": "none" },
          "fieldA": { ... }
        },
        "required": ["type"]
      }
    ]
  }
}
```

## Supported Icons

Use any of these values in the `icons` map:

`article`, `blockquote`, `carousel-horizontal`, `carousel-vertical`, `clock-hour-11`, `code`,
`color-swatch`, `columns-2`, `columns-3`, `container`, `device-mobile`, `device-laptop`,
`device-tablet`, `float-right`, `float-left`, `heading`, `html`, `layout`, `layout-bottombar`,
`layout-grid`, `link`, `list`, `list-numbers`, `map-plus`, `music`, `numbers`, `photo-plus`,
`plus`, `section`, `seo`, `separator`, `share`, `slideshow`, `square-plus`, `table-plus`,
`template`, `text-caption`, `text-plus`, `typography`, `video-plus`

## Full Worked Example

```json
{
  "sections": {
    "type": "array",
    "title": "Page Sections",
    "ui:component": {
      "params": {
        "icons": {
          "rich-text": "typography",
          "image": "photo-plus",
          "banner": "carousel-horizontal",
          "video": "video-plus",
          "cta": "link"
        }
      }
    },
    "items": {
      "oneOf": [
        {
          "type": "object",
          "title": "Rich Text",
          "properties": {
            "type": { "const": "rich-text", "ui:component": "none" },
            "content": { "type": "string", "format": "markdown", "title": "Content" }
          },
          "required": ["type"]
        },
        {
          "type": "object",
          "title": "Image",
          "allOf": [{ "$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/image-link" }]
        },
        {
          "type": "object",
          "title": "Banner",
          "ui:component": {
            "name": "tabs",
            "params": {
              "tabs": {
                "defaultTab": "Content",
                "items": [
                  { "label": "Content", "pointers": ["/title", "/image"] },
                  { "label": "Styles", "pointers": ["/titleColor", "/titleSize"] }
                ]
              }
            }
          },
          "properties": {
            "type": { "const": "banner", "ui:component": "none" },
            "title": { "type": "string", "title": "Title", "maxLength": 100 },
            "image": {
              "title": "Image",
              "allOf": [
                { "$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/image-link" }
              ]
            },
            "titleColor": { "type": "string", "format": "color", "title": "Title Color" },
            "titleSize": {
              "type": "number",
              "title": "Title Size",
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
          },
          "required": ["type"]
        },
        {
          "type": "object",
          "title": "Video",
          "allOf": [{ "$ref": "http://bigcontent.io/cms/schema/v1/core#/definitions/video-link" }]
        },
        {
          "type": "object",
          "title": "CTA",
          "properties": {
            "type": { "const": "cta", "ui:component": "none" },
            "label": { "type": "string", "title": "Button Label", "maxLength": 50 },
            "url": { "type": "string", "format": "uri", "title": "URL" },
            "target": {
              "type": "string",
              "title": "Open in",
              "oneOf": [
                { "const": "_blank", "title": "New Tab" },
                { "const": "_self", "title": "Same Tab" }
              ]
            }
          },
          "required": ["type"]
        }
      ]
    }
  }
}
```
