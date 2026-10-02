[← Back](..)

# Command reference

Everything Amplience Frontend Starter can do from the command line, and where the same
operation lives in the Environment Manager GUI.

Two things worth knowing before you start:

- **Run everything from the repo root.** The root `package.json` forwards to the
  right workspace, so you never need to `cd` into `apps/` or `packages/`.
- **The GUI and the terminal are the same operations.** The Environment Manager
  shells out to the very scripts listed here and streams their output into a log
  panel. Neither route can do something the other can't, so use whichever suits
  the moment — the GUI for setup and one-off operations, the terminal for
  scripting and CI.

## Local development

No Amplience hub and no credentials needed — these run against the bundled
fixture data, fully offline.

| Command      | What it does                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm i`     | Installs all workspace dependencies <br/>(alias of `pnpm install`)                                                                          |
| `pnpm dev`   | Starts the Next.js dev server on [localhost:3000](http://localhost:3000) <br/>(Or [localhost:3001](http://localhost:3001)+ if 3000 is busy) |
| `pnpm build` | Builds a production build of `apps/web`                                                                                                     |
| `pnpm start` | Serves the production build <br/>(run `pnpm build` first)                                                                                   |
| `pnpm sb`    | Runs storybook on [localhost:6006](http://localhost:6006) <br/>(alias of `pnpm storybook`)                                                  |

## Quality gates

The same checks CI runs. Worth running before you push.

| Command              | What it does                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`          | ESLint across the workspace, warnings treated as errors                                                        |
| `pnpm lint:fix`      | Same, applying safe autofixes                                                                                  |
| `pnpm lint:cleanup`  | Autofix _including_ the deliberately-wrapped rules (e.g. unused imports) — see [Editor setup](editor-setup.md) |
| `pnpm format`        | Prettier write                                                                                                 |
| `pnpm format:check`  | Prettier check only                                                                                            |
| `pnpm typecheck`     | `tsc --noEmit` at the root and in every package                                                                |
| `pnpm test`          | Vitest, single run                                                                                             |
| `pnpm test:watch`    | Vitest in watch mode                                                                                           |
| `pnpm test:coverage` | Vitest with coverage; enforces the repo-wide 90% floor (ADR-0006)                                              |

## Environment Manager

```sh
pnpm env-manager
```

Starts the local GUI — UI on [localhost:5174](http://localhost:5174) (opens
automatically), API on port 3099. It's the front door for everything hub- and
deployment-related:

- Add, edit and remove hub environments; **Set active** switches local dev
  between the fixtures and any hub you've added
- **Fetch hub details** and **Check credentials** — the latter probes read and
  write capability per resource area, so you find out about a missing permission
  before a seed fails halfway through
- Per-resource **Seed** / **Sync** / **Wipe** with live counts and a streaming log
- Create, redeploy and destroy Vercel sites (ADR-0017)

The **Webhooks** row is the one resource that depends on something outside the
hub: a webhook needs a deployment to call, so one is seeded per registered site
and the row does nothing until you've added one. See
[Working with a hub](working-with-a-hub.md#webhooks).

Configuration it writes lands in a gitignored `amplience.config.json` plus
`.env` files. Credentials never reach version control.

## Seeding and syncing a hub

Pushes the content model and starter content from source control to a hub. Both
routes need the hub configured first — see
[Working with a hub](working-with-a-hub.md), and the
[seeding runbook](runbooks/hub-setup.md) for the full walkthrough.

```sh
pnpm hub:import               # everything, in dependency order (~1m45s)

pnpm hub:import:settings      # preview devices, locales, workflow states
pnpm hub:import:schemas       # JSON Schemas
pnpm hub:import:types         # content-type registrations (+ visualizations)
pnpm hub:import:extensions    # UI and dashboard extensions
pnpm hub:import:webhooks      # publish → cache-invalidation webhooks, one per registered site
pnpm hub:import:content       # fixture content items
pnpm hub:import --set <name>  # seed one fixture set's content (see Fixture sets)

pnpm hub:wipe                 # reset the hub to empty, webhooks included (~45s)
pnpm hub:wipe:content         # content items only, leaving the model in place
pnpm hub:wipe:types           # content types (content must be gone first)
pnpm hub:wipe:schemas         # schemas (content and types must be gone first)
pnpm hub:wipe:extensions      # UI and dashboard extensions
pnpm hub:wipe:webhooks        # just the seeded webhooks

pnpm hub:wipe content --set <name>  # one fixture set's items, leaving the others
pnpm hub:wipe content --orphaned    # items seeded from a set that has left the repo
pnpm hub:wipe content --custom      # items authored on the hub, never seeded
```

Four things about `hub:import` that aren't obvious from the name:

- **It is also the "push my changes" command.** Re-running updates items in place
  rather than duplicating them, because every phase shares one dc-cli mapping
  file. There is no separate `push`.
- **The order matters and is not alphabetical.** Settings first (extensions and
  content reference workflow-state IDs that the settings step mints), then
  schemas → types → extensions → webhooks → content. `pnpm hub:import` handles
  this for you; the individual steps are for iterating on one layer.
- **The webhooks step doesn't use dc-cli.** `dc-cli webhook import` discards the
  top-level `secret` and every header marked `"secret": true`, so a webhook
  seeded through it arrives unauthenticated and fails on every delivery. That
  step calls the Management API directly instead (via `dc-management-sdk-js`,
  already a dependency), which also means it needs `AMPLIENCE_CLIENT_ID`,
  `_SECRET` and `AMPLIENCE_HUB_ID` explicitly — it has no dc-cli configuration
  to fall back on. See `packages/hub-management/webhooks/README.md`.
- **A failed step is safe to re-run.** It exits non-zero with dc-cli's own
  output; the mapping file makes repeats idempotent.

`hub:wipe` is destructive and has no confirmation prompt in the terminal — the
GUI equivalent does prompt. It frees delivery keys, retracts published content
where the hub allows unpublish, then archives content, types and schemas. A full
wipe also deletes the webhooks the seed created; `pnpm hub:wipe:webhooks` does
only that. Only webhooks labelled `Quadratic — …` are ever touched, so anything
hand-made or belonging to another integration survives both a wipe and a
re-seed.

The per-resource wipes run in the same dependency order as the seed, in reverse:
a type in use by a content item can't be removed, and a schema can't be removed
while a type references it. Each refuses rather than half-completing, naming the
step to run first. `pnpm hub:wipe items` still works as an alias for
`hub:wipe content`.

The three selectors — `--set`, `--orphaned`, `--custom` — act on content items
only, so they can't be combined with another scope. They read the dc-cli mapping
file to tell seeded items from hand-authored ones, which makes them specific to
the machine that did the seeding: on any other machine everything looks
hand-authored, and the script refuses rather than guess. `--set` is the only one
that runs unprompted, because the repository can put it back; `--orphaned` and
`--custom` print what they would remove and need `--apply` to go ahead.

In the Environment Manager the same three appear as child rows under **Content
items** — one per set the hub is carrying, plus _Orphaned_ and _Custom_ when it
holds any. Sets the repository has that this hub doesn't are offered together on
a **+ Seed a fixture set** row rather than a row each, so the table stays a
description of the hub as more sets are added. A
control that can't act isn't rendered rather than greyed out, so those two rows
carry no **Sync** — there is no source on disk to sync from — and their **Wipe**
reports what it found before a second click removes it.

With no import map on this machine, every scoped control disappears and the row
breakdown says why. The wholesale **Wipe** on the parent row and **Wipe all**
stay, because they enumerate the hub and need no provenance at all — so wiping
and re-seeding remains a way out, and rebuilds the map as it goes.

### Fixture sets

Starter content lives in named sets under `packages/content/fixtures/`, one
directory each. A set's name is also its delivery-key prefix, so several can be
seeded onto one hub side by side and each deployment reads only its own
(ADR-0019). `frontend-starter` is the one a zero-config deployment gets.

`--set <name>` picks which set a content command acts on; `FIXTURE_SET` in the
environment does the same. With neither, `pnpm hub:import` asks at a terminal
when more than one set exists, and takes the default when there is nothing to
ask (the Environment Manager, CI). Only the content step varies by set — the
schemas, types and extensions are shared, and are seeded once.

### Configuration

The `hub:*` scripts read the environment, usually from
`packages/hub-management/.env` (copy `.env.example`). Shell variables take
precedence.

| Variable                                               | Purpose                                                                                                                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AMPLIENCE_HUB_NAME`                                   | Visualization URIs, and the import-map file name                                                                                                                                                                      |
| `AMPLIENCE_APP_URL`                                    | Production visualization origin                                                                                                                                                                                       |
| `AMPLIENCE_REPO_CONTENT`                               | Content repository ID                                                                                                                                                                                                 |
| `AMPLIENCE_REPO_SLOTS`                                 | Slots repository ID                                                                                                                                                                                                   |
| `AMPLIENCE_REPO_SITE_COMPONENTS`                       | Site Components repository ID (custom CSS — ADR-0016)                                                                                                                                                                 |
| `AMPLIENCE_CLIENT_ID` / `_SECRET` / `AMPLIENCE_HUB_ID` | Credentials. All three together, or omit all three to use your active dc-cli configuration                                                                                                                            |
| `SITE_NAME`                                            | Delivery-key namespace override (ADR-0014); defaults to the fixture set's name                                                                                                                                        |
| `FIXTURE_SET`                                          | Which fixture set the content step seeds; same as `--set`                                                                                                                                                             |
| `AMPLIENCE_REVALIDATE_SECRET`                          | Shared secret seeded into webhook headers, and checked by the deployment's `/api/revalidate-*` routes. Must match the value set on the deployment; unset means those webhooks are skipped, not seeded unauthenticated |
| `AMPLIENCE_REPUBLISH=1`                                | Force-publish every item, not just changed ones                                                                                                                                                                       |
| `AMPLIENCE_IGNORE_SCHEMA_VALIDATION=1`                 | Skip the pre-import fixture/schema validation. Diagnostic only                                                                                                                                                        |

## Deploying a site

Site provisioning is GUI-only today: in the Environment Manager, open a hub
environment and use the site rows to **Deploy** a new Vercel project, **Redeploy**
an existing one, or **Remove** it (with the option to destroy the Vercel project
too). It wraps the Vercel CLI plus the REST API for the settings the CLI can't
reach, and it needs the Vercel CLI installed and authenticated — the GUI
preflights both and tells you what's missing.

There is no `pnpm deploy`. For the manual route, and for the environment
variables a deployment needs, see [Deploying a site](deploying.md).

## Generating docs content

```sh
pnpm docs:generate
```

Regenerates the fixture content items that mirror this `docs/` folder, so the
reference demo's own documentation pages stay in step with the markdown. Run it
after editing anything under `docs/`, then `pnpm hub:import:content` to push the
result to a hub.

## Not yet available

Deliberately deferred, so you don't go looking for them:

| Capability                                   | Status                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pull` — hub → repo                          | **Deferred** (requirements §1.3, COULD). The repo is the source of truth for the content model; there is no supported way to bring UI-authored schema changes back into it, so reconcile by hand. A normalising schema pull is the intended v1-migration path and the likelier of these to land first. |
| `backup` / `restore`                         | **Deferred** (requirements §1.3, COULD). Recovery is `pnpm hub:wipe` followed by a re-seed from source control — which restores the model and the starter content, but not content editors have authored on the hub since.                                                                             |
| `diff`, `promote` (hub → hub)                | **Deferred** to the MVP automation CLI (ADR-0012).                                                                                                                                                                                                                                                     |
| Schema deletion                              | Not supported by dc-cli. Removing a content type from a hub is a manual operation in the CMS UI.                                                                                                                                                                                                       |
| `--dry-run`                                  | Planned at MVP for every hub-mutating operation (requirements §1.3).                                                                                                                                                                                                                                   |
| A single `frontend-starter <command>` binary | Planned at MVP (ADR-0012). The commands above are its INTERIM form.                                                                                                                                                                                                                                    |

## GUI ↔ terminal equivalence

| Environment Manager                               | Terminal                                        |
| ------------------------------------------------- | ----------------------------------------------- |
| **Set active** on a fixture set                   | — (default with no hub configured)              |
| **+ Add hub** → **Fetch hub details**             | — (GUI only; writes `amplience.config.json`)    |
| **Check credentials**                             | — (GUI only)                                    |
| Settings row → **Seed** / **Sync**                | `pnpm hub:import:settings`                      |
| Content type schemas row → **Seed** / **Sync**    | `pnpm hub:import:schemas`                       |
| Content types row → **Seed** / **Sync**           | `pnpm hub:import:types`                         |
| Extensions row → **Seed** / **Sync**              | `pnpm hub:import:extensions`                    |
| Webhooks row → **Seed** / **Sync**                | `pnpm hub:import:webhooks`                      |
| Webhooks row → **Wipe**                           | `pnpm hub:wipe:webhooks`                        |
| Schemas row → **Wipe**                            | `pnpm hub:wipe:schemas`                         |
| Content types row → **Wipe**                      | `pnpm hub:wipe:types`                           |
| Extensions row → **Wipe**                         | `pnpm hub:wipe:extensions`                      |
| Content items row → **Seed**                      | `AMPLIENCE_REPUBLISH=1 pnpm hub:import:content` |
| Content items row → **Sync**                      | `pnpm hub:import:content`                       |
| Content items row → **Wipe**                      | `pnpm hub:wipe:content`                         |
| A set's child row → **Sync**                      | `pnpm hub:import:content --set <name>`          |
| **+ Seed a fixture set** → **Seed**               | `pnpm hub:import:content --set <name>`          |
| A set's child row → **Wipe**                      | `pnpm hub:wipe content --set <name>`            |
| _Orphaned_ child row → **Wipe**                   | `pnpm hub:wipe content --orphaned [--apply]`    |
| _Custom_ child row → **Wipe**                     | `pnpm hub:wipe content --custom [--apply]`      |
| All resources → **Seed all**                      | `AMPLIENCE_REPUBLISH=1 pnpm hub:import`         |
| All resources → **Sync all**                      | `pnpm hub:import`                               |
| All resources → **Wipe all**                      | `pnpm hub:wipe`                                 |
| Site row → **Deploy** / **Redeploy** / **Remove** | — (GUI only)                                    |

Seed and Sync differ only for content items, where Seed force-republishes
everything and Sync publishes new and changed items only. For settings, schemas,
types, extensions and webhooks the two buttons run the identical command — the
naming reflects intent (first run vs update), not different behaviour.

## Where these are defined

| Layer                          | Location                                                 |
| ------------------------------ | -------------------------------------------------------- |
| Root passthrough scripts       | `package.json`                                           |
| Hub import / wipe              | `packages/hub-management/scripts/`                       |
| Environment Manager UI + API   | `apps/environment-manager/`                              |
| GUI operation → script mapping | `apps/environment-manager/server/index.ts` (`OP_CONFIG`) |
