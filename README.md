# Quadratic Lite

An open-source accelerator for the Amplience Quadratic demo platform.

> Status: Proof of Concept (POC) — not production ready.

## Supported Node versions

Quadratic Lite requires Node.js 22 or newer (see [`engines.node`](package.json) in `package.json`). Node 20 reached end-of-life in April 2026; Node 22 is the current Active LTS. Editor / lint / test tooling is verified against the same range that CI uses.

pnpm is the package manager (see [`packageManager`](package.json)). If it's not already installed, `corepack enable` picks up the pinned version automatically.

## Getting started

Local setup takes about 40 seconds, and needs no Amplience hub:

1. Clone the repo\
   `git clone https://github.com/amplience/quadratic-lite.git`

2. Navigate into the directory\
   `cd quadratic-lite`

3. Install the packages\
   `pnpm i` or `pnpm install`

4. Start the development server\
   `pnpm dev`

That starts the Next.js app at `http://localhost:3000`. By default it serves content from the bundled fixture data (`packages/content/fixtures/`), so it runs fully offline.

## Component library

The shared component library has its own Storybook, for browsing or building components in isolation from the app.

You can start this by running `pnpm sb` or `pnpm storybook`

## Connecting to a hub

The local dev server can also be pointed at a real Amplience hub instead of the fixtures. Adding one takes about 50 seconds via the environment manager GUI:

1. Run `pnpm env-manager` to start the GUI
2. Click **+ Add hub**
3. Give it a label and identifier (free text, just for your own reference)
4. Enter the Client ID and Client Secret you received from Amplience support
5. Click **Fetch hub details**
6. Review the details, then click **Add hub**

_Under the hood this fetches and stores the relevant details in an untracked `quadratic.config.json` file and some `.env` variables, but you should be able to do everything you need through the GUI._

You can then switch the local dev server between the fixtures (default) and any hub you've added, to source its content instead. See [`docs/runbooks/hub-setup.md`](docs/runbooks/hub-setup.md) for the prerequisites (API client, repository IDs) and what each field maps to.

## Seeding and syncing a hub

Once a hub is added, you can push the Quadratic Lite content model and starter content to it. (Takes typically 1min 45sec)

You can either do it via the environment-manager GUI as mentioned above, or you could use the terminal if you prefer.

Example terminal commands:

```sh
pnpm hub:import # imports schemas, content types, then fixture content (~1m45s end to end)

pnpm hub:wipe   # frees delivery keys, then clears content, content-types, schemas (~45s end to end)

pnpm hub:import:schemas # Only imports the schemas
```

The same import command is also how you push local changes to a hub you've already seeded — it updates in place rather than duplicating. Full detail, including verification steps and publishing behaviour, is in [`docs/runbooks/hub-setup.md`](docs/runbooks/hub-setup.md).

## Deploying a frontend

`apps/web` is a standard Next.js app — host it anywhere (e.g. Vercel). The only variable you need to point it at a real hub instead of the bundled fixtures is:

| Variable             | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `AMPLIENCE_HUB_NAME` | Hub to read content from. Unset = fixture data, no hub required. |

Delivery keys are namespaced by site (ADR-0014): keys on the hub are `<site>/<path>`, so the `acme` site's `/about` page is the item keyed `acme/about` (the name never appears in URLs). The site name defaults to the hub name — the same default `pnpm hub:import` seeds under, so hub and deployment agree out of the box. Set `SITE_NAME` explicitly for a site not named after its hub (lowercase letters, digits, single hyphens — and pick it once: it's baked into every delivery key, so changing it later means re-keying all content).

Everything else is optional, with sensible accelerator defaults:

| Variable                 | Purpose                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| `SITE_NAME`              | Delivery-key namespace override (see above). Defaults to the hub name.        |
| `NEXT_PUBLIC_BRAND`      | Selects the brand theme (`data-brand`, scoping the CSS-variable overrides).   |
| `FAVICON_BASE_URL`       | Base path for a custom favicon set, e.g. `/favicon`.                          |
| `SITE_TITLE`             | Default site title (also feeds the `"<page title> \| SITE_TITLE"` template).  |
| `SITE_DESCRIPTION`       | Default SEO description. Both can be overridden per page in the CMS.          |
| `THEME_COLOR`            | Browser-chrome theme colour, e.g. `#7340e7`.                                  |
| `AMPLIENCE_STAGING_HOST` | VSE domain — when set, reads serve latest saved (not just published) content. |
| `AMPLIENCE_LOCALE`       | Locale forwarded to the delivery API, e.g. `en-GB`.                           |

See [`apps/web/.env.example`](apps/web/.env.example) for the full list, defaults, and notes.

To register a deployed site against a hub, open that hub's card in `env-manager`. There are two paths (see [ADR-0017](docs/04-architecture/adr/0017-vercel-site-provisioning.md)):

- **+ Add existing site** — records a site you've already deployed (any host): give it a URL, brand, and site name. Reference only; nothing is created.
- **+ Create Vercel site** — provisions a new Vercel project from the values this hub already holds: it creates the project, pushes the runtime env vars, deploys `apps/web`, and records the resulting URL for you. Needs the [Vercel CLI](https://vercel.com/docs/cli) installed and logged in (`vercel login`); a preflight check guides you if not. Only non-secret runtime variables are pushed — the Amplience OAuth credentials are management-only and never leave your machine.

Either way, once a site is recorded it's added as a visualization option in the CMS whenever you next seed or sync that hub's content types.

> **Vercel project settings:** the provisioned project uses Vercel's default Build, Output, Install, and Development commands, with **Root Directory set to `apps/web`** and the **framework preset set to Next.js** (both applied via one Vercel API call, since neither is settable from the CLI). The pnpm workspace resolves automatically (Vercel includes files outside the root directory by default), so no custom `vercel.json` is needed.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow, and [`docs/editor-setup.md`](docs/editor-setup.md) for recommended (optional) editor settings.

## Troubleshooting

If you see a `[DEP0169] DeprecationWarning: url.parse()` line, that's coming from inside pnpm's own bundled code (not this project) — see [pnpm#9492](https://github.com/pnpm/pnpm/issues/9492). It's cosmetic; silence it by adding `export NODE_OPTIONS="--disable-warning=DEP0169"` to your shell profile.
