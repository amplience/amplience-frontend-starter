# Renderer

The recursive dispatcher from ADR-0010 — Renderer pattern (see the project architecture docs) — a content tree goes in, a React tree comes out, and anything that can't be dispatched renders a visible failure card in place rather than nothing. Section references below (§n) point at ADR-0010's conventions.

## The flow, end to end

A content tree (here, what the mock client returns for `getByKey('home', { depth: 'all' })`):

```jsonc
{
  "_meta": { "schema": "https://quadratic.amplience.com/v2/content/page" },
  "title": "Welcome to Amplience Frontend Starter",
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
import { defaultRegistry } from '@amplience/frontend-starter-components/registry'

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

### Content-fetch failures (page-level)

The three classes above cover "the tree arrived but a node can't render". A fourth surface covers "the tree never arrived" (QL-37): routes catch `ContentClientError` from the content client and act on its `kind` — `not-found` becomes a branded 404 via `notFound()`, every other kind renders `ContentUnavailableCard` in place of the page tree, server-rendered like the dispatch cards, with the same dev-verbose/prod-redacted console emission (`emitContentFailure`). Only genuinely unexpected errors fall through to `app/error.tsx`, the one client-component piece of the failure surface.

Per-route wiring a new page needs: the `generateMetadata` stub, plus the try/catch shown in `app/page.tsx`. Failure kinds are testable without an SDK via `makeFailingContentClient(kind)` from `@amplience/frontend-starter-content/mock`.

### Smoke-checking

`/debug/failures` renders every failure card through the real dispatcher and the real route path — development only (404s in production).

## Theming

The renderer itself is brand-agnostic — it never reads theme state. Branding happens entirely in CSS: `app/layout.tsx` imports the token contract from [`@amplience/frontend-starter-theme`](../../../../packages/theme/README.md) and sets the brand attribute on the root element:

```tsx
<html lang="en" data-brand={process.env.NEXT_PUBLIC_BRAND ?? 'default'}>
```

Every component the dispatcher renders styles itself through CSS variables, so the `[data-brand]` overlays in [`tokens.css`](../../../../packages/theme/src/tokens.css) cascade to the whole tree from that single attribute (ADR-0002 §5 — see the project architecture docs). One brand per deployment at POC/MVP: `NEXT_PUBLIC_BRAND` is deployment configuration (`.env.example` documents it), and the `'default'` fallback intentionally matches no overlay — out of the box the reference page renders the plain `:root` token values.

### Adding a brand

A new brand never touches this directory; the renderer's dispatch path is identical for every brand. The steps live elsewhere:

1. Define the overlay — a `[data-brand='name']` block of token redefinitions, per [the brand override guide](../../../../packages/theme/README.md#how-a-brand-overrides-tokens) in the theme package.
2. Make it previewable — add the brand to the Storybook toolbar `items` in `packages/components/.storybook/preview.tsx`.
3. Deploy it — set `NEXT_PUBLIC_BRAND="name"` for that deployment.

Because activation is one attribute on one element, a future multi-brand-per-deployment model (ADR-0002 §7) would change where the attribute is set, not how components or this renderer work.

## Graduation

This directory promotes to a `packages/renderer` workspace the first time a second consumer needs it (ADR-0010, "Where the renderer lives"). Until then the package boundary would be ceremony without a consumer.
