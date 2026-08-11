[← Back](..)

# Deploying a site

`apps/web` is a standard Next.js app — host it anywhere. (e.g. Vercel)

## Environment Variables

All environment variables are optional with sensible accelerator defaults. However, you will likely want `AMPLIENCE_HUB_NAME` in order to point it at a real hub instead of the bundled fixtures.

| Variable                 | Purpose                                                                                                          | e.g.                                               | Default when not set                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `AMPLIENCE_HUB_NAME`     | Which hub to read content from                                                                                   | `quadraticdemo`                                    | Use fixture data, no hub required.                     |
| `AMPLIENCE_LOCALES`      | Which locales are supported.                                                                                     | `en-GB,en-US,fr-FR,de-DE,es-ES`                    | Single-locale only                                     |
| `SITE_NAME`              | The [namespace](#site-namespacing) used in delivery keys                                                         | `acme`                                             | Use `AMPLIENCE_HUB_NAME`                               |
| `NEXT_PUBLIC_BRAND`      | Selects the brand theme (`data-brand`, scoping the CSS-variable overrides).                                      | `acme`                                             | 'Default' base theme (Minimal CSS)                     |
| `FAVICON_BASE_URL`       | Base path for a custom favicon set. (Can even be external)                                                       | `https://www.acme.com/favicon`                     | '/favicon'                                             |
| `SITE_TITLE`             | Default site title (also feeds the `"<page title> \| SITE_TITLE"` template across the site).                     | `ACME Corp`                                        | 'Quadratic Lite'                                       |
| `SITE_DESCRIPTION`       | Default SEO description. Both can be overridden per page in the CMS.                                             | `A quick demo site for the ACME corporation`       | 'A clean starting point for an Amplience-backed site.' |
| `THEME_COLOR`            | Browser-chrome theme colour.                                                                                     | `#7340e7`                                          | None                                                   |
| `AMPLIENCE_STAGING_HOST` | VSE domain — when set, it bypasses the 'published' state to serve the latest saved (not just published) content. | `1234567890abcdefghijklmnop.staging.bigcontent.io` | None                                                   |

See [`apps/web/.env.example`](../apps/web/.env.example) for the full list, defaults, and notes.

## Site namespacing

Delivery keys are namespaced by site: keys on the hub are `<site>/<path>`, so the `acme` site's `/about` page is the item keyed `acme/about` (the name never appears in URLs).

If you don't specify any namespace in the env vars, it defaults to the hub name — the same default `pnpm hub:import` seeds under, so hub and deployment agree out of the box.

Set `SITE_NAME` explicitly for a site not named after its hub (lowercase letters, digits, single hyphens — and pick it once: it's baked into every delivery key, so changing it later means re-keying all content).

## Registering a deployed site

To register a deployed site against a hub, open that hub's card in `env-manager`. There are two paths:

- **+ Add existing site** — records a site you've already deployed (any host): give it a URL, brand, and site name. Reference only; nothing is created.
- **+ Create Vercel site** — provisions a new Vercel project from the values this hub already holds: it creates the project, pushes the runtime env vars, deploys `apps/web`, and records the resulting URL for you. Needs the [Vercel CLI](https://vercel.com/docs/cli) installed and logged in (`vercel login`); a preflight check guides you if not. Only non-secret runtime variables are pushed — the Amplience OAuth credentials are management-only and never leave your machine.

Either way, once a site is recorded it's added as a visualization option in the CMS whenever you next seed or sync that hub's content types.

A newly recorded site is also what webhooks need in order to exist — they're created one per registered site, so seed them (**Webhooks → Seed**, or `pnpm hub:import:webhooks`) after adding one. See [Webhooks](working-with-a-hub.md#webhooks).

> [!TIP] Manual Vercel setup
> To host on Vercel by hand instead:
>
> 1. Fork the repo into the GitHub account linked to Vercel.
> 2. Create a Vercel project from that repo.
>    - Use Vercel's default Build, Output, Install, and Development commands
>    - Set **Root Directory** to `apps/web`
>    - Set **Framework preset** to Next.js
>    - Set the `AMPLIENCE_HUB_NAME` env variable to your hub name
> 3. Use **+ Add existing site** to add the new site to your config.
> 4. Sync content types to update the visualizer list.
>
> Steps 2–3 are done for you automatically by the **+ Create Vercel site** button in the Environment Manager GUI.
