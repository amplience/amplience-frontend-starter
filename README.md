# Quadratic Lite

An open-source accelerator for the Amplience Quadratic demo platform.

> [!NOTE] Status: Lightweight MVP
> This is a lightweight performant accelerator to get you started. Please fork and build upon this.
>
> NB: If you are internal staff and want to demo more advanced features, they might be available on [Quadratic](https://github.com/amplience/quadratic), our older private (but more feature-rich) demo frontend.
>
> Eventually Quadratic Lite will expand to reach feature parity with the older Quadratic codebase, but in the meantime you can still run the original for the features not yet migrated.

## Getting started

### Prerequisites

#### Node.js v22+

Quadratic Lite requires Node.js v22 or newer, although we currently recommend v24.

- ~~v**20**~~ (Iron) reached end-of-life in April 2026
- v**22** (Jod) is in **Maintenance LTS** (critical fixes only; EOL ~April 2027) — this is our supported floor
- v**24** (Krypton) is the current **Active LTS** and the recommended version for local development
- v**26** is the current _Current_ release — fine to experiment with, but not for production

It's standard practice that production and CI should target an _Active_ or _Maintenance_ LTS release.\
Editor / lint / test tooling is verified against the same range CI uses.

> [!TIP]Node Version Manager (nvm)
> If you need to install node, we'd recommend doing so via [nvm](https://www.nvmnode.com/) so you can easily install & switch between versions using commands like `nvm list`, `nvm install 24` and `nvm use 24`.
>
> - [How to install nvm on Windows](https://www.nvmnode.com/guide/download.html#nvm-for-windows-nvm-windows)
> - [How to install nvm on Mac/Linux/Ubuntu](https://www.nvmnode.com/guide/download.html#nvm-for-linux-ubuntu-mac-nvm-sh)

#### PNPM

As a monorepo, we use [pnpm (performant node package manager)](https://pnpm.io/) as the package manager. If it's not already installed, just run `corepack enable` which will pick up the pinned version automatically.

### Steps

Local setup takes about 40 seconds, and needs no Amplience hub:

1. Clone the repo\
   `git clone https://github.com/amplience/quadratic-lite.git`

2. Navigate into the directory\
   `cd quadratic-lite`

3. Install the packages\
   `pnpm i` or `pnpm install`

### Running locally

1. Start the development server\
   `pnpm dev`

2. See the results in a browser at\
   [http://localhost:3000](http://localhost:3000)

By default it serves content from the bundled fixture data (`packages/content/fixtures/`), so it runs fully offline.

NB: If you wish to build a _static_ site: run `pnpm build` to build the site, then `pnpm start` to run the server. But this won't live update to your code changes, so `pnpm dev` is most often preferred for local development.

### Component library

The shared component library has its own Storybook for browsing or building components in isolation from the app.

1. Start storybook\
   `pnpm sb` or `pnpm storybook`

2. View the results in a browser at\
   [http://localhost:6006](http://localhost:6006)

## Connecting to a hub

The local dev server can also be pointed at a real Amplience hub instead of the fixtures. Adding one takes about 50 seconds via the environment manager GUI:

### Prerequisites

- A Client ID & secret with full DC+DAM permissions for your hub

### Steps

1. Start the Environment Manager GUI\
   `pnpm env-manager`

2. Click **+ Add hub**

3. Give it a label and identifier (free text, just for your own reference)

4. Enter the Client ID and Client Secret you received from Amplience support

5. Click **Fetch hub details**

6. Review the details, then click **Add hub**

_Under the hood this fetches and stores the relevant details in an untracked `quadratic.config.json` file and some `.env` variables, but these are not committed to the repo and you should be able to do everything you need through the GUI._

> [!TIP] Checking Permissions
> If you are running into permission errors or just want to check the permissions before you start, you can use the **Check credentials** button.

You can then, by clicking the **Set active** buttons, switch the local dev server between pointing at the fixtures (default) and any hub you've added, to source its content instead. See [`docs/runbooks/hub-setup.md`](docs/runbooks/hub-setup.md) for more details.

## Seeding and syncing a hub

Once a hub is added, you can push the Quadratic Lite content model and starter content to it. (Takes typically 1min 45sec for a full set of starter content)

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

### Minor pnpm noise

If you see a `[DEP0169] DeprecationWarning: url.parse()` line, that's coming from inside pnpm's own bundled code (not this project) — see [pnpm#9492](https://github.com/pnpm/pnpm/issues/9492). It's cosmetic; silence it by adding `export NODE_OPTIONS="--disable-warning=DEP0169"` to your shell profile.
