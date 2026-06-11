# Renderer

The recursive dispatcher from ADR-0010 — Renderer pattern (see the project architecture docs) — a content tree goes in, a React tree comes out, and anything that can't be dispatched renders a visible failure card in place rather than nothing. Section references below (§n) point at ADR-0010's conventions.

## The flow, end to end

A content tree (here, what the mock client returns for `getByKey('home', { depth: 'all' })`):

```jsonc
{
  "_meta": { "schema": "https://quadratic.amplience.com/v2/content/page" },
  "title": "Welcome to Quadratic Lite",
  "slots": [
    {
      "_meta": {
        "schema": "https://quadratic.amplience.com/v2/slots/slot",
        "name": "Home — main slot",
      },
      "components": [
        { "_meta": { "schema": "https://quadratic.amplience.com/v2/content/hero" }, "title": "…" },
        {
          "_meta": { "schema": "https://quadratic.amplience.com/v2/content/columns" },
          "items": [
            {
              "_meta": { "schema": "https://quadratic.amplience.com/v2/content/image" },
              "image": { "…": "…" },
            },
          ],
        },
      ],
    },
  ],
}
```

A registry (the deployment's composition act — `lib/registry.ts` uses the library default):

```ts
import { defaultRegistry } from '@amplience/quadratic-components/registry'

export const registry = defaultRegistry
```

One call renders the whole tree:

```tsx
import { registry } from '@/lib/registry'
import { renderContent } from '@/src/renderer'

export default async function HomePage() {
  const page = await client.getByKey('home', { depth: 'all' })
  return renderContent(page, registry)
}
```

## How dispatch works

For each node, the dispatcher reads `_meta.schema` and looks the URI up in the registry — no aliasing, no string transformation (§3). The entry supplies:

- `component` — what to render.
- `propsFromSchema` — content body → props. Omitted means identity (§4). Receives the `RenderContext`, which carries layout cues (`bare`) to nested blocks.
- `getChildren` — _container entries only_ (Page, Slot, ColumnsBlock, GridBlock): returns the child nodes. The dispatcher renders them recursively and passes the result as `children`, applying the entry's `childContext` (layout containers set `{ bare: true }`). This is the one recursion mechanism — pages, slots, and layout blocks all dispatch the same way.
- `validate` — optional renderer-edge validator (ADR-0009 §10); not yet used by the default entries.

Before the lookup, three structural guards protect the dispatcher from malformed input: array nodes render element-wise, a node missing `_meta.schema` fails loudly, and an unresolved content-link stub gets a card with a fetch-depth hint.

## Loud failure (§5B, §6)

Each failure renders a card _in place_ — the rest of the page renders normally — and emits a structured console signal (verbose in development, redacted in production, §8).

| Class                    | Meaning                                                               | Likely culprit                    |
| ------------------------ | --------------------------------------------------------------------- | --------------------------------- |
| `SchemaUnknown`          | URI not in the registry (or unresolved link / missing `_meta.schema`) | Content modelling, fetch depth    |
| `ComponentUnregistered`  | URI registered, entry has no `component`                              | Deployment registry composition   |
| `PropsValidationFailure` | `validate` rejected, or an adapter threw                              | Entry's adapter vs. content shape |

The card is identical in dev and prod; dev adds an expandable `<details>` diagnostics block. It's a native disclosure element, so the renderer ships no client JavaScript — it runs as a Server Component all the way down (§11).

## Graduation

This directory promotes to a `packages/renderer` workspace the first time a second consumer needs it (ADR-0010, "Where the renderer lives"). Until then the package boundary would be ceremony without a consumer.
