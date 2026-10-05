# @amplience/frontend-starter-content

The `ContentClient` port and its POC mock implementation — the integration seam
between the renderer and the Amplience SDK. Established by
[ADR-0008](../../04-architecture/adr/0008-content-sdk.md).

## What's here today

| Module                                                     | Status              |
| ---------------------------------------------------------- | ------------------- |
| `ContentClient` port + shared types                        | POC (QL-15 / QL-23) |
| `MockContentClient` — fixture-backed adapter               | POC (QL-23)         |
| `SdkContentClient` — `dc-delivery-sdk-js`-backed adapter   | Done (QL-43)        |
| `resolveContentConfig` — env → client selection, one place | Done (QL-43)        |

The mock and the SDK adapter satisfy the same port — the SDK test suite
asserts parity against the mock for every fixture at both depths. Anything
that consumes content — pages, components, the renderer — depends on the
port, not on the concrete adapter.

## Quick start

```ts
import { resolveContentConfig } from '@amplience/frontend-starter-content'
import { makeMockContentClient } from '@amplience/frontend-starter-content/mock'
import { makeSdkContentClient } from '@amplience/frontend-starter-content/sdk'

const config = resolveContentConfig() // env-driven; no config → mock
const client = config.kind === 'sdk' ? makeSdkContentClient(config) : makeMockContentClient()

const home = await client.getByKey('frontend-starter/homepage', { depth: 'all' })
//             ↑ ContentItem with all content-links resolved inline
```

With `CONTENT_CLIENT=sdk` and `AMPLIENCE_HUB_NAME` set, the same call serves
the real hub (optionally via `AMPLIENCE_STAGING_HOST` for latest-saved
content). Unset, it's an offline fixture set — a fresh clone needs no
configuration at all.

`makeMockContentClient()` serves the default set. There are several (see
[Fixture sets](#fixture-sets)); `FIXTURE_SET` picks one, or pass a name:
`makeMockContentClient('anyafinn')`. Each set is its own namespace, so a client
built for one refuses keys belonging to another rather than quietly missing.

`depth` mirrors the Amplience delivery API:

- `depth: 'root'` (default) — content-links stay as reference stubs.
  Matches the delivery API's default; useful when you want to resolve
  references lazily.
- `depth: 'all'` — the resolver walks the body and inlines each referenced
  item recursively. Cycles are guarded; unresolved references leave the
  stub in place for the renderer to surface (ADR-0010).

## Fixtures

Fixtures live under `fixtures/<set>/` in **dc-cli enriched format** — the same
shape `dc-cli content-item import` consumes, so the same folder doubles as seed
data (ADR-0012). Schema URIs use the `https://quadratic.amplience.com/v2/`
namespace.

### Fixture sets

There is more than one body of content (ADR-0019). Each directory under
`fixtures/` holding a `set.json` is a **fixture set**, and its directory name is
also its delivery-key prefix — so several sets can be seeded onto one hub side by
side, and each deployment reads only its own.

| Set                | `set.json` says              | What it is                                                |
| ------------------ | ---------------------------- | --------------------------------------------------------- |
| `frontend-starter` | brand `amplience`, 6 locales | The default. Introductory content mirroring the docs.     |
| `anyafinn`         | brand `anyafinn`, 3 locales  | A fashion-retail demo.                                    |
| `bare-bones`       | brand `default`, 3 locales   | Header, footer and a one-block homepage — a blank canvas. |

`set.json` carries the set's label, description, `defaultBrand`, `defaultLocale`
and `authoredLocales`. The brand is the set's own, which is why switching set
switches the theme with nothing else to configure.

### A worked path through one set

Taking `frontend-starter`'s home page — the page references a slot, the slot
references the components, and only the page carries a delivery key:

| File                            | Schema URI                    | Delivery key                |
| ------------------------------- | ----------------------------- | --------------------------- |
| `pages/home.json`               | `…/v2/content/page`           | `frontend-starter/homepage` |
| `slots/home-main.json`          | `…/v2/slots/slot`             | —                           |
| `components/home-hero.json`     | `…/v2/content/hero`           | —                           |
| `components/home-markdown.json` | `…/v2/content/markdown-block` | —                           |

Together they exercise both flat lookup
(`getByKey('frontend-starter/homepage')`) and graph resolution (`depth: 'all'`).
Components are reached through the graph rather than by key, which is why they
need none of their own.

### Adding a fixture

1. Drop the JSON file under `fixtures/<set>/` — any nested folder is fine, since
   the structure is purely organisational.
2. Add a static import to that set's module, `src/mock/sets/<set>.ts`, and append
   it to the set's `fixtures` array. A brand-new set is also registered in
   `src/mock/loader.ts`, which is the registry rather than a fixture list.
3. Run `pnpm fixtures:ids` to stamp its id. Ids are derived from
   `uuidFrom("<set>/<path>")`, so they're globally unique across sets — which is
   what makes a per-set wipe computable from disk alone.

The manual import list keeps the mock runtime-portable (browser, edge and Node
all work the same). When the fixture count grows past "you can read them all in a
coffee", we may revisit with a build-time generator.
