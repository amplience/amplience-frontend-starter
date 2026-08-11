[← Back](..)

# Command reference

Everything Quadratic Lite can do from the command line, and where the same
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

Configuration it writes lands in a gitignored `quadratic.config.json` plus
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

pnpm hub:wipe                 # reset the hub to empty, webhooks included (~45s)
pnpm hub:wipe items           # content items only, leaving the model in place
pnpm hub:wipe webhooks        # just the seeded webhooks
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
wipe also deletes the webhooks the seed created; `pnpm hub:wipe webhooks` does
only that. Only webhooks labelled `Quadratic — …` are ever touched, so anything
hand-made or belonging to another integration survives both a wipe and a
re-seed.

### Configuration

The `hub:*` scripts read the environment, usually from
`packages/hub-management/.env` (copy `.env.example`). Shell variables take
precedence.

| Variable                                               | Purpose                                                                                                                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AMPLIENCE_HUB_NAME`                                   | Visualization URIs, and the default site name                                                                                                                                                                         |
| `AMPLIENCE_APP_URL`                                    | Production visualization origin                                                                                                                                                                                       |
| `AMPLIENCE_REPO_CONTENT`                               | Content repository ID                                                                                                                                                                                                 |
| `AMPLIENCE_REPO_SLOTS`                                 | Slots repository ID                                                                                                                                                                                                   |
| `AMPLIENCE_REPO_SITE_COMPONENTS`                       | Site Components repository ID (custom CSS — ADR-0016)                                                                                                                                                                 |
| `AMPLIENCE_CLIENT_ID` / `_SECRET` / `AMPLIENCE_HUB_ID` | Credentials. All three together, or omit all three to use your active dc-cli configuration                                                                                                                            |
| `SITE_NAME`                                            | Delivery-key namespace override (ADR-0014); defaults to the hub name                                                                                                                                                  |
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

| Capability                            | Status                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pull` — hub → repo                   | **Deferred** (requirements §1.3, COULD). The repo is the source of truth for the content model; there is no supported way to bring UI-authored schema changes back into it, so reconcile by hand. A normalising schema pull is the intended v1-migration path and the likelier of these to land first. |
| `backup` / `restore`                  | **Deferred** (requirements §1.3, COULD). Recovery is `pnpm hub:wipe` followed by a re-seed from source control — which restores the model and the starter content, but not content editors have authored on the hub since.                                                                             |
| `diff`, `promote` (hub → hub)         | **Deferred** to the MVP automation CLI (ADR-0012).                                                                                                                                                                                                                                                     |
| Schema deletion                       | Not supported by dc-cli. Removing a content type from a hub is a manual operation in the Dynamic Content UI.                                                                                                                                                                                           |
| `--dry-run`                           | Planned at MVP for every hub-mutating operation (requirements §1.3).                                                                                                                                                                                                                                   |
| A single `quadratic <command>` binary | Planned at MVP (ADR-0012). The commands above are its INTERIM form.                                                                                                                                                                                                                                    |

## GUI ↔ terminal equivalence

| Environment Manager                               | Terminal                                        |
| ------------------------------------------------- | ----------------------------------------------- |
| **Set active** on _Local Fixtures_                | — (default with no hub configured)              |
| **+ Add hub** → **Fetch hub details**             | — (GUI only; writes `quadratic.config.json`)    |
| **Check credentials**                             | — (GUI only)                                    |
| Settings row → **Seed** / **Sync**                | `pnpm hub:import:settings`                      |
| Content type schemas row → **Seed** / **Sync**    | `pnpm hub:import:schemas`                       |
| Content types row → **Seed** / **Sync**           | `pnpm hub:import:types`                         |
| Extensions row → **Seed** / **Sync**              | `pnpm hub:import:extensions`                    |
| Webhooks row → **Seed** / **Sync**                | `pnpm hub:import:webhooks`                      |
| Webhooks row → **Wipe**                           | `pnpm hub:wipe webhooks`                        |
| Content items row → **Seed**                      | `AMPLIENCE_REPUBLISH=1 pnpm hub:import:content` |
| Content items row → **Sync**                      | `pnpm hub:import:content`                       |
| Content items row → **Wipe**                      | `pnpm hub:wipe items`                           |
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
