# @amplience/quadratic-content

The `ContentClient` port and its POC mock implementation — the integration seam
between the renderer and the Amplience SDK. Established by
[ADR-0008](../../04-architecture/adr/0008-content-sdk.md).

## What's here today

| Module                                                         | Status              |
| -------------------------------------------------------------- | ------------------- |
| `ContentClient` port + shared types                            | POC (QL-15 / QL-23) |
| `MockContentClient` — fixture-backed adapter                   | POC (QL-23)         |
| `AmplienceContentClient` — `dc-delivery-sdk-js`-backed adapter | Pending (QL-43)     |

The mock and the SDK adapter satisfy the same port. Anything that consumes
content — pages, components, the renderer — depends on the port, not on the
concrete adapter.

## Quick start

```ts
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

const client = makeMockContentClient()
const home = await client.getByKey('home', { depth: 'all' })
//             ↑ ContentItem with all content-links resolved inline
```

`depth` mirrors the Amplience delivery API:

- `depth: 'root'` (default) — content-links stay as reference stubs.
  Matches the delivery API's default; useful when you want to resolve
  references lazily.
- `depth: 'all'` — the resolver walks the body and inlines each referenced
  item recursively. Cycles are guarded; unresolved references leave the
  stub in place for the renderer to surface (ADR-0010).

## Fixtures

Fixtures live under `fixtures/base-site/` in **dc-cli enriched format** —
the same shape `dc-cli content-item import` consumes. That means the same
folder doubles as seed data once the hub-setup automation lands
(ADR-0012). Schema URIs use the `https://quadratic.amplience.com/v2/`
namespace; content is deliberately unbranded.

| File                        | Schema URI                | Delivery key |
| --------------------------- | ------------------------- | ------------ |
| `pages/home.json`           | `…/v2/content/page`       | `home`       |
| `slots/home-main.json`      | `…/v2/slots/slot`         | `home/main`  |
| `components/home-hero.json` | `…/v2/content/banner`     | `home/hero`  |
| `components/home-text.json` | `…/v2/content/text-block` | `home/intro` |

The home page references the slot; the slot references the hero and the
text block. Together they exercise both flat lookup (`getByKey('home')`)
and graph resolution (`depth: 'all'`).

Adding a fixture is two steps:

1. Drop the JSON file under `fixtures/base-site/` (any nested folder is
   fine — folder structure is purely organisational).
2. Add a static import to `src/mock/loader.ts` and append it to the
   `fixtures` array.

The manual loader list keeps the mock runtime-portable (browser, edge, Node
all work the same). When the fixture count grows past "you can read them
all in a coffee", we may revisit with a build-time generator.
