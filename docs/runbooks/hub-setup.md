# Runbook — seeding an Amplience hub

How a fresh Dynamic Content hub comes to carry the Quadratic Lite content
model and starter content. Everything the hub needs lives in this repo —
schemas and content types in `packages/schemas/`, starter content in
`packages/content/fixtures/base-site/` (the same files the mock client
serves, so the hub and local dev never drift) — and one command pushes it
all. Running it against a second hub is the same procedure with different
environment values.

> **INTERIM (QL-92):** the import runs through dc-cli wrapper scripts until
> the automation CLI's `quadratic schemas push` supersedes them (QL-58,
> ADR-0012 — schema-as-code and hub sync). The file layout is already the
> one that CLI will consume.

## Prerequisites (once per hub)

1. **A hub on an org you can administer**, with Content Delivery v2 enabled
   (delivery keys depend on it).
2. **An API client** (client ID + secret) for the hub — from Amplience
   support or your org admin.
3. **Repository IDs** for the `content` and `slots` repositories. In the DC
   UI these are in each repository's settings; the seeding for the reference
   hub (`quadraticlite`) used:
   - content: `6a03b80d273dc65652a8dd1a`
   - slots: `6a03b813c09912743234ee8a`
4. **Node + pnpm** per the repo root README; `pnpm install` pulls dc-cli as
   a dev dependency, so no global install is involved.

## Configure

The import reads its configuration from the environment. The usual home for
it is `packages/schemas/.env` — copy `.env.example` there and fill it in;
the `hub:import` scripts load it automatically (Node's `--env-file-if-exists`,
no dotenv dependency):

```sh
AMPLIENCE_HUB_NAME="quadraticlite"          # visualization URIs
AMPLIENCE_APP_URL="https://quadratic-lite-web.vercel.app"  # Production viz origin
AMPLIENCE_REPO_CONTENT="6a03b80d273dc65652a8dd1a"
AMPLIENCE_REPO_SLOTS="6a03b813c09912743234ee8a"
AMPLIENCE_CLIENT_ID="..."                   # ┐ optional — omit all three
AMPLIENCE_CLIENT_SECRET="..."               # │ to use your active
AMPLIENCE_HUB_ID="..."                      # ┘ dc-cli configuration
```

Variables exported in your shell work identically and take precedence. The
`.env` copy is gitignored; credentials never reach version control, and the
import script never echoes them.

The hub details shown above belong to the public reference demo, which is
why they can appear in this file. Details of any other hub — names, VSE
domains, repository IDs — identify the organisations a deployment serves,
so they stay in your own gitignored or private configuration even though
they aren't credentials.

## Run

```sh
pnpm hub:import
```

That executes three steps in order; each is also runnable on its own from
`packages/schemas/` when iterating:

| Step | Script                    | What happens                                                                                                                                     |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `pnpm hub:import:schemas` | Registers the JSON Schemas (8 types + 2 partials) from `content-type-schemas/`                                                                   |
| 2    | `pnpm hub:import:types`   | Stages `content-types/` with `${hub}` and `${appUrl}` substituted, imports with `--sync` so visualization changes reach already-registered types |
| 3    | `pnpm hub:import:content` | Imports fixtures leaf-first — components → slots → pages — each into its repository, with `--publish`                                            |

The leaf-first order exists because dc-cli rewrites cross-item links using
a mapping file: by the time a slot or page arrives, every item it links to
is already in the map. The script passes one explicit shared map
(`~/.amplience/imports/quadratic-<hubName>.json`) to every phase — dc-cli's
default is a map _per repository_, which would null any link whose target
lives in the other repository. The same shared map is what makes re-running
the import update items in place rather than duplicate them — so
`pnpm hub:import` is also the "push my changes" command for content model
and starter content alike.

## Verify

1. **DC UI** — the eight content types appear under their repositories;
   starter items exist in Content (pages + components) and Slots; each item
   shows its variant delivery keys on the Content delivery tab.
2. **Published delivery** — items were imported with `--publish`, so
   fetch-by-key works on production CD2 (any variant key returns the item,
   with all keys in `_meta.deliveryKeys`):

   ```sh
   curl "https://<hubName>.cdn.content.amplience.net/content/key/homepage?depth=all&format=inlined"
   ```

   If a key 404s immediately after publishing, you may be seeing the CDN's
   cached pre-publish 404 — it expires on its own, or vary a _known_ query
   parameter (e.g. add `&locale=en`) to get a fresh cache entry. Unknown
   cache-buster params are stripped from the cache key and won't help.

3. **Staging VSE** — the same fetch against the hub's staging domain serves
   the latest saved (not necessarily published) versions:

   ```sh
   curl "https://<vse-domain>/content/key/homepage?depth=all&format=inlined"
   ```

A failed step exits non-zero with dc-cli's own output — fix and re-run that
step; the mapping file makes repeats safe.

One publishing nuance: dc-cli only treats an item as publishable when its
_source file_ carries a `lastPublishedDate` — an export artefact that
hand-authored fixtures naturally lack. The staging step injects a marker
date so `--publish` behaves the way you'd expect: items that changed this
run or were never published on the hub get published; unchanged
already-published items are left alone. `AMPLIENCE_REPUBLISH=1`
force-publishes everything regardless.

## What this paves

The fixture-validation test (`packages/schemas/src/fixtures.test.ts`) keeps
fixtures and schemas agreeing in CI with no hub access, so a contributor PR
that changes either is checked before it ever reaches a hub. The schema
manifest (`packages/schemas/src/index.ts`) and this import sequence are the
inputs the QL-58 automation CLI formalises — and that CLI is in turn what
the self-serve setup GUI drives.
