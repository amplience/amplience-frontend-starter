[← Back](..)

# Getting started

Everything you need to clone Quadratic Lite and get it running locally on the bundled fixture data — no Amplience hub required.

## Prerequisites

### Node.js v22+

Quadratic Lite requires Node.js v22 or newer, although we currently recommend v24.

- ~~v**20**~~ (Iron) reached end-of-life in April 2026
- v**22** (Jod) is in **Maintenance LTS** (critical fixes only; EOL ~April 2027) — this is our supported floor
- v**24** (Krypton) is the current **Active LTS** and the recommended version for local development
- v**26** is the current _Current_ release — fine to experiment with, but not for production

It's standard practice that production and CI should target an _Active_ or _Maintenance_ LTS release.\
Editor / lint / test tooling is verified against the same range CI uses.

> [!TIP] Node Version Manager (nvm)
> If you need to install node, we'd recommend doing so via [nvm](https://www.nvmnode.com/) so you can easily install & switch between versions using commands like `nvm list`, `nvm install 24` and `nvm use 24`.
>
> - [How to install nvm on Windows](https://www.nvmnode.com/guide/download.html#nvm-for-windows-nvm-windows)
> - [How to install nvm on Mac/Linux/Ubuntu](https://www.nvmnode.com/guide/download.html#nvm-for-linux-ubuntu-mac-nvm-sh)

### pnpm

As a monorepo, we use [pnpm (performant node package manager)](https://pnpm.io/) as the package manager. If it's not already installed, just run `corepack enable`, which picks up the pinned version automatically.

## Installation

Local setup takes about 40 seconds, and needs no Amplience hub:

1. Clone the repo\
   `git clone https://github.com/amplience/quadratic-lite.git`

2. Navigate into the directory\
   `cd quadratic-lite`

3. Install the packages\
   `pnpm i` or `pnpm install`

## Running locally

1. Start the development server\
   `pnpm dev`

2. See the results in a browser at\
   [http://localhost:3000](http://localhost:3000)

By default it serves content from the bundled fixture data (`packages/content/fixtures/`), so it runs fully offline.

> [!NOTE] Building a production build
> To build a _production_ build, run `pnpm build` to build, then `pnpm start` to serve it. This won't live-update as you change code, so `pnpm dev` is usually preferred for local development.

See [Commands](commands.md) for a full list of terminal commands and what they each do.

## Next steps

- Browse the component library in Storybook — see [Storybook](storybook.md).
- Point local dev at a real Amplience hub and seed it — see [Working with a hub](working-with-a-hub.md).
- Deploy the frontend — see [Deploying a site](deploying.md).
