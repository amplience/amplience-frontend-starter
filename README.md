# Quadratic Lite

An open-source frontend accelerator for Amplience.

> [!NOTE] Status: Lightweight MVP
> This is a lightweight performant accelerator to get you started. Please fork and build upon this.
>
> NB: If you are internal staff and want to demo more advanced features, they might be available on [Quadratic](https://github.com/amplience/quadratic), our older private (but more feature-rich) demo frontend.
>
> Eventually Quadratic Lite will expand to reach feature parity with the older Quadratic codebase, but in the meantime you can still run the original for the features not yet migrated.

## Quickstart

_New to the stack, or need Node / pnpm set up first? See [Getting started](docs/getting-started.md) for fuller details._

Local setup takes about 40 seconds and needs no Amplience hub:

```sh
git clone https://github.com/amplience/quadratic-lite.git
cd quadratic-lite
pnpm i
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000) — it serves the bundled fixture data, fully offline.

Your next steps will likely be to use:

- Environment Manager to manage your hubs & sites: `pnpm env-manager`
- Storybook for component development: `pnpm sb`

## Documentation

- [Overview](docs/index.md) — what Quadratic Lite is and how the content-driven renderer works
- [Getting started](docs/getting-started.md) — prerequisites, install, running locally
- [Storybook](docs/storybook.md) — browse the component library in isolation
- [Working with a hub](docs/working-with-a-hub.md) — connect local dev to a real Amplience hub and seed it
- [Command reference](docs/commands.md) — every terminal command and its Environment Manager equivalent
- [Deploying a site](docs/deploying.md) — host `apps/web` and point it at a hub
- [Theming](docs/theming.md) — update/override design tokens or apply custom CSS, all managed from the codebase or the CMS
- [Editor setup](docs/editor-setup.md) — optional on-save formatting & lint config
- [Troubleshooting](docs/troubleshooting.md) — common gotchas
- [Contributing](CONTRIBUTING.md) — workflow and conventions
