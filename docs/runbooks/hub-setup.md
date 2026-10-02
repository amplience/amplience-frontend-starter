[← Back](..)

# Runbook — seeding an Amplience hub

How a fresh Amplience CMS hub comes to carry the Amplience Frontend Starter
content model and starter content. Everything the hub needs lives in this repo —
settings, schemas, content types and extensions in `packages/hub-management/`,
starter content in `packages/content/fixtures/` (the same files the mock client
serves, so the hub and local dev never drift).

There are two ways to do it, and they do the same work. The **Environment
Manager** is a local web app with a button per step; the **terminal commands** are
what it runs underneath. Start with the GUI — it fills in the configuration for
you and will not let you run the steps out of order. Drop to the terminal when
you want to script something, read exactly what is happening, or use a flag the
GUI doesn't expose.

> **INTERIM (QL-92):** the import runs through dc-cli wrapper scripts until the
> automation CLI's `frontend-starter schemas push` supersedes them (QL-58,
> ADR-0012 — schema-as-code and hub sync). The file layout is already the one
> that CLI will consume.

## Prerequisites (once per hub)

These are the same whichever route you take.

1. **A hub on an org you can administer**, with Content Delivery v2 enabled
   (delivery keys depend on it) and **unpublish enabled** (ask Amplience
   support). Archiving a content item does not retract its published snapshot,
   so a hub that can't unpublish accumulates one live copy of the seed per
   wipe/seed cycle — invisible against a staging VSE, but schema-wide reads in
   production return every copy. The wipe says so when it can't unpublish.
2. **An API client** (client ID + secret) for the hub — from Amplience support
   or your org admin. The wipe's retraction pass needs it: without credentials
   it can only archive.
3. **Repository IDs** for the `content` and `slots` repositories. In the DC UI
   these are in each repository's settings. The GUI can discover them for you
   from the credentials alone; the reference hub (`quadraticlite`) used:
   - content: `6a03b80d273dc65652a8dd1a`
   - slots: `6a03b813c09912743234ee8a`
4. **Node + pnpm** per the repo root README. `pnpm install` pulls dc-cli as a
   dev dependency, so no global install is involved.
5. **A site name** (ADR-0014). Every delivery key on the hub lives under it —
   `<siteName>/homepage`, `<siteName>/about` — and the frontend deployment
   reading the hub resolves the same value. By default it is the fixture set's
   name, so a hub seeded with one set needs no configuration at all. Lowercase
   letters, digits and single hyphens. Choose it deliberately: it is baked into
   every key the seed creates, and every key editors add afterwards, so changing
   it later means re-keying all content. It names the frontend consumer, not the
   brand.

## Seeding through the Environment Manager

```sh
pnpm env-manager
```

That opens a local web app. Nothing it shows leaves your machine; it writes
`amplience.config.json` and the two `.env` files, all gitignored.

1. **Add the hub.** `+ Add hub`, paste the client ID and secret, then **Fetch hub
   details** — it discovers the hub and its repositories for you. **Check
   credentials** tells you what the API client can and can't do before you rely
   on it.
2. **Set it active.** Exactly one content source is active across the panel,
   either a hub or a fixture set. Activating writes both `.env` files together,
   so the pages you see locally and the hub the commands target can't drift
   apart.
3. **Seed, in order.** Expand the hub card for a table of resources — settings,
   schemas, content types, extensions, webhooks, content items — each with its
   own **Seed**. **Seed all** runs them in dependency order and is what you want
   on a fresh hub. The order matters and isn't alphabetical; see the table in
   [Seeding from the terminal](#seeding-from-the-terminal) for why.
4. **Add the content.** Content items break down by fixture set. On a fresh hub
   use **+ Seed a fixture set**, pick one, and seed it.

Counts refresh as each step finishes, so the table is also the verification.

### Working with fixture sets

Starter content lives in named sets under `packages/content/fixtures/`, one
directory each (ADR-0019). A set's name is also its delivery-key prefix, so
several can live on one hub side by side and each deployment reads only its own.

Under **Content items** you'll see a row per set the hub is carrying, plus any
of these:

| Row                      | What it is                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| A set                    | Seeded from a fixture set still in the repo. **Sync** pushes repo changes; **Wipe** removes just this set.     |
| _Orphaned_               | Seeded from a fixture that has since left the repo — a retired set, a renamed fixture, an older naming scheme. |
| _Custom_                 | Authored on the hub rather than seeded. The repo has no copy; this may be someone's only one.                  |
| **+ Seed a fixture set** | The sets the repo has that this hub doesn't. Click to pick one.                                                |

_Orphaned_ and _Custom_ offer **Wipe** but never **Sync** — there is no source on
disk to sync from, which is what defines them. Both report what they would remove
and wait for a second confirmation, because neither can be put back from the
repository.

A **Locales** row shows what the hub has. Amplience Support configures these per
hub, so they vary; the seed drops any authored locale the hub lacks and says so
("2 of 3 locales kept" on the set's row). Locales the hub has but the set doesn't
are left absent rather than filled — the app already falls back.

> **If the per-set rows are missing**, the panel says why. Working out which set
> an item came from needs dc-cli's import map, which lives on the machine that
> did the seeding. Without it the breakdown can't be computed, so those controls
> are hidden rather than guessed at. Seeding still works, and so do the
> whole-hub **Wipe** and **Wipe all** — wipe and re-seed is a real way out, and
> rebuilds the map as it goes.

## Seeding from the terminal

Everything above, as commands. Use this when you want to script it, or need a
flag the GUI doesn't surface.

### Configure

The scripts read the environment, usually from `packages/hub-management/.env` —
copy `.env.example` there and fill it in. They load it automatically (Node's
`--env-file-if-exists`, no dotenv dependency). The Environment Manager writes
this same file, so the two routes are interchangeable.

```sh
AMPLIENCE_HUB_NAME="quadraticlite"          # visualization URIs
# SITE_NAME="my-site"                       # delivery-key namespace (ADR-0014)
# FIXTURE_SET="frontend-starter"            # which content (ADR-0019)
AMPLIENCE_APP_URL="https://quadratic-lite-web.vercel.app"  # production viz origin
AMPLIENCE_REPO_CONTENT="6a03b80d273dc65652a8dd1a"
AMPLIENCE_REPO_SLOTS="6a03b813c09912743234ee8a"
AMPLIENCE_CLIENT_ID="..."                   # ┐ optional — omit all three
AMPLIENCE_CLIENT_SECRET="..."               # │ to use your active
AMPLIENCE_HUB_ID="..."                      # ┘ dc-cli configuration
```

`SITE_NAME` and `FIXTURE_SET` are separate on purpose: one says which namespace
the content lands in, the other says which content goes there. That separation is
what lets one hub carry several sets, and what lets a partner seed the starter
set under their own name. The Environment Manager always writes them as a pair,
so they can't drift; hand-edit one and the import refuses rather than seeding
into the wrong namespace.

Shell variables work identically and take precedence. The `.env` copy is
gitignored, credentials never reach version control, and the scripts never echo
them.

The hub details above belong to the public reference demo, which is why they can
appear in this file. Details of any other hub — names, VSE domains, repository
IDs — identify the organisations a deployment serves, so they stay in your own
private configuration even though they aren't credentials.

### Run

```sh
pnpm hub:import
```

That executes six steps in order — five mirror dc-cli's own `hub clone` pipeline
(settings → schema → type → extension → … → content), with webhooks slotted in
before content so the sequence matches the order the Environment Manager lists
resources in. Each is runnable on its own when iterating:

| Step | Script                       | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm hub:import:settings`   | Imports `settings/*.json` — preview devices, locales and the workflow states. First because content items and dashboard extensions reference states by id, and dc-cli mints a fresh id per state on each hub, recording the source→target ids in `~/.amplience/imports/quadratic-settings-<hub>.json`                                                                                                                                                                                                           |
| 2    | `pnpm hub:import:schemas`    | Registers the JSON Schemas from `content-type-schemas/`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3    | `pnpm hub:import:types`      | Stages `content-types/` with `${hub}` and `${appUrl}` substituted, imports with `--sync` so visualization changes reach already-registered types                                                                                                                                                                                                                                                                                                                                                                |
| 4    | `pnpm hub:import:extensions` | Stages `extensions/*.json` with hub-independent tokens resolved — `${repo:content}` → the content repo, `${status:Label}` → the workflow-state id the settings step created for that label — then imports. Depends on step 1                                                                                                                                                                                                                                                                                    |
| 5    | `pnpm hub:import:webhooks`   | Creates one webhook per web app registered against this hub, from `webhooks/*.json`, with `${site:url}` / `${site:label}` / `${secret:…}` resolved per deployment. Skipped when the hub has no web apps, or when a definition's secret isn't set — never seeded unauthenticated. Needs `AMPLIENCE_CLIENT_ID` / `_SECRET` / `AMPLIENCE_HUB_ID` explicitly. Before content, so the seed's own publishes exercise the webhooks it just created — a wrong secret shows up in the hub's delivery log during the seed |
| 6    | `pnpm hub:import:content`    | Stages one fixture set with its delivery keys re-prefixed to the site namespace (`SITE_NAME`, default: the set's own name — ADR-0014), drops any locale the hub lacks, then imports leaf-first — components → slots → pages — each into its repository, with `--publish`                                                                                                                                                                                                                                        |

Only step 6 varies by fixture set; the model is shared, so steps 1–5 run once
however many sets the hub carries.

### Seeding a second set

```sh
pnpm hub:import:content --set anyafinn
```

`--set` wins over `FIXTURE_SET`. With neither, and more than one set on disk,
`pnpm hub:import` asks at a terminal and takes the default where it can't (CI,
or the Environment Manager).

### Wiping

```sh
pnpm hub:wipe                      # everything — extensions and seeded webhooks included (~45s)
pnpm hub:wipe:content              # content items only, model left in place
pnpm hub:wipe content --set anyafinn   # one set, leaving the others
pnpm hub:wipe content --orphaned       # reports; add --apply to act
pnpm hub:wipe content --custom         # reports; add --apply to act
```

The per-resource wipes run in the reverse of the seed order and refuse while
anything still depends on them — a type in use by a content item can't be
removed — naming the step to run first rather than half-completing.

`--set` runs unprompted, because the repository can put that content back.
`--orphaned` and `--custom` print what they would remove and need `--apply`,
because nothing can.

Full reference: [Commands](../commands.md).

## Verify

1. **DC UI** — the content types appear under their repositories; starter items
   exist in Content (pages + components) and Slots; each item shows its delivery
   keys on the Content delivery tab.
2. **Published delivery** — items are imported with `--publish`, so fetch-by-key
   works on production CD2:

   ```sh
   curl "https://<hubName>.cdn.content.amplience.net/content/key/<siteName>/homepage?depth=all&format=inlined"
   ```

   If a key 404s immediately after publishing, you may be seeing the CDN's cached
   pre-publish 404 — it expires on its own, or vary a _known_ query parameter
   (e.g. add `&locale=en`) to get a fresh cache entry. Unknown cache-buster
   params are rejected outright, and `/` in a delivery key must not be
   percent-encoded.

3. **Staging VSE** — the same fetch against the hub's staging domain serves the
   latest saved (not necessarily published) versions:

   ```sh
   curl "https://<vse-domain>/content/key/<siteName>/homepage?depth=all&format=inlined"
   ```

A failed step exits non-zero with dc-cli's own output — fix and re-run that step;
the mapping file makes repeats safe.

> **⚠️ Orphaned delivery keys.** Removing a delivery key from a **published**
> item orphans it: the key goes on serving that item's last published snapshot
> indefinitely, even once the item is unpublished and archived. Retraction
> matches on the key the item still holds, so the order has to be unpublish →
> remove or change the key → publish.
>
> Unpublishing on its own is unaffected — a page taken down with its key intact
> stops serving immediately, which is the behaviour routing by delivery key
> depends on. It is specifically editing or clearing the key of a **published**
> item that strands it.
>
> The wipe does this correctly, but a hub wiped by a version before 2 Oct 2026
> may carry orphaned keys — a lookup by delivery key serves content that the
> same lookup by delivery id reports as gone.
>
> To reclaim one: add the orphaned key to another content item, publish that
> item, then unpublish it. Re-seeding clears it too, since publishing new
> content under the same key overwrites the entry.

### Why the order matters

The leaf-first content order exists because dc-cli rewrites cross-item links
using a mapping file: by the time a slot or page arrives, every item it links to
is already in the map. The script passes one explicit shared map
(`~/.amplience/imports/quadratic-<hubName>.json`) to every phase — dc-cli's
default is a map _per repository_, which would null any link whose target lives
in the other repository. That shared map is also what makes re-running the import
update items in place rather than duplicate them, so `pnpm hub:import` is the
"push my changes" command too. There is no separate `push`.

⚠️ The map is **machine-local**. Someone else seeding the same hub from their own
machine has no map, and dc-cli would create duplicates rather than update. Until
that's addressed, treat one machine as the one that seeds a given hub.

### Why webhooks don't use dc-cli

`dc-cli webhook import` discards the top-level `secret` and filters out every
header marked `"secret": true` before creating the webhook — the credential is
exactly what makes the call work, so a webhook seeded that way 401s on every
delivery. Step 5 uses the Management API through `dc-management-sdk-js` instead
(already a dependency), which keeps secret headers intact, makes `active: false`
expressible, and uses the webhook's label as its identity rather than a mapping
file. Every webhook it creates is labelled `Quadratic — …`, and it only ever
creates, updates or deletes webhooks with that prefix — a hand-made webhook on a
shared hub is never touched. Resolved definitions are never written to disk, so
no staged file holds a secret. See `packages/hub-management/webhooks/README.md`.

### A publishing nuance

dc-cli only treats an item as publishable when its _source file_ carries a
`lastPublishedDate` — an export artefact that hand-authored fixtures naturally
lack. The staging step injects a marker date so `--publish` behaves the way you'd
expect: items that changed this run or were never published on the hub get
published; unchanged already-published items are left alone.
`AMPLIENCE_REPUBLISH=1` force-publishes everything regardless, and is what the
GUI's **Seed** sends where **Sync** doesn't.

## What this paves

The fixture-validation test (`packages/hub-management/src/fixtures.test.ts`) keeps
fixtures and schemas agreeing in CI with no hub access, so a contributor PR that
changes either is checked before it ever reaches a hub. The schema manifest
(`packages/hub-management/src/index.ts`) and this import sequence are the inputs
the QL-58 automation CLI formalises — and that CLI is in turn what the self-serve
setup GUI drives.
