[← Back](..)

# Deploying a site

`apps/web` is a standard Next.js app — host it anywhere. (e.g. Vercel)

## Environment Variables

All environment variables are optional with sensible accelerator defaults. However, you will likely want `AMPLIENCE_HUB_NAME` in order to point it at a real hub instead of a bundled fixture set.

| Variable                 | Purpose                                                                                                          | e.g.                                               | Default when not set                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `AMPLIENCE_HUB_NAME`     | Which hub to read content from                                                                                   | `quadraticdemo`                                    | Use a fixture set, no hub required.                    |
| `AMPLIENCE_LOCALES`      | Which locales are supported.                                                                                     | `en-GB,en-US,fr-FR,de-DE,es-ES`                    | Single-locale only                                     |
| `SITE_NAME`              | The [namespace](#site-namespacing) used in delivery keys. Only read with a hub.                                  | `acme`                                             | The fixture set's name (`FIXTURE_SET`)                 |
| `FIXTURE_SET`            | Offline: which bundled fixture set to serve. With a hub: the default for `SITE_NAME`.                            | `anyafinn`                                         | `frontend-starter`                                     |
| `CONTENT_CLIENT`         | Force the offline mock while a hub name is set — for debugging fixture data against live hub config.             | `mock`                                             | Hub if named, fixtures otherwise                       |
| `NEXT_PUBLIC_BRAND`      | Selects the brand theme (`data-brand`, scoping the CSS-variable overrides).                                      | `acme`                                             | 'Default' base theme (Minimal CSS)                     |
| `FAVICON_BASE_URL`       | Base path for a custom favicon set. (Can even be external)                                                       | `https://www.acme.com/favicon`                     | '/favicon'                                             |
| `SITE_TITLE`             | Default site title (also feeds the `"<page title> \| SITE_TITLE"` template across the site).                     | `ACME Corp`                                        | 'Amplience Frontend Starter'                           |
| `SITE_DESCRIPTION`       | Default SEO description. Both can be overridden per page in the CMS.                                             | `A quick demo site for the ACME corporation`       | 'A clean starting point for an Amplience-backed site.' |
| `THEME_COLOR`            | Browser-chrome theme colour.                                                                                     | `#7340e7`                                          | None                                                   |
| `AMPLIENCE_STAGING_HOST` | VSE domain — when set, it bypasses the 'published' state to serve the latest saved (not just published) content. | `1234567890abcdefghijklmnop.staging.bigcontent.io` | None                                                   |
| `PRODUCT_SOURCE`         | Where product data comes from — see [Products](#products).                                                       | `commercetools`                                    | `cms`                                                  |

See [`apps/web/.env.example`](../apps/web/.env.example) for the full list, defaults, and notes.

## Products

Product pages (`/products/<slug>`), the `/products` listing and category pages (`/<category>`) read through one product source, chosen by `PRODUCT_SOURCE`. Both sources serve the same routes and components, so switching is an environment change, not a code change.

- **`cms`** (default) — products are items of the [`product` content type](content-types.md#product), read through whichever content client is active. Offline that's the bundled fixture set, so a clone with no configuration has a working catalogue. Categories are derived from the products' own `categories` values.
- **`commercetools`** — products are read live from a commercetools project. Categories come from the project's category tree.

An unrecognised `PRODUCT_SOURCE` stops the site at boot rather than serving an empty catalogue.

| Variable                   | Purpose                                                                                                | e.g.                            | Default when not set                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- | -------------------------------------- |
| `PRODUCT_SOURCE`           | `cms` or `commercetools`.                                                                              | `commercetools`                 | `cms`                                  |
| `PRODUCT_CURRENCIES`       | Locale → currency map. Prices are never converted: a product with no price in the currency shows none. | `en-GB:GBP,en-US:USD,de-DE:EUR` | Every locale uses the default currency |
| `PRODUCT_CURRENCY_DEFAULT` | Currency for any locale not in `PRODUCT_CURRENCIES`.                                                   | `EUR`                           | `GBP`                                  |
| `PRODUCT_LISTING_LIMIT`    | Products per listing page. `0` means no limit.                                                         | `24`                            | `48`                                   |

### commercetools

Read only when `PRODUCT_SOURCE="commercetools"`. The three credentials are required — a missing one stops the site at boot. An API client with `view_products` and `view_categories` is enough; the site only reads. The names follow commercetools' `CTP_` convention, so the "Environment variables" download from creating an API client pastes straight in.

| Variable                          | Purpose                                                                                                                                                                                                                                                             | e.g.                     | Default when not set                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------- |
| `CTP_PROJECT_KEY`                 | Project key. **Required.**                                                                                                                                                                                                                                          | `anyafinn`               | —                                     |
| `CTP_CLIENT_ID`                   | API client id. **Required.**                                                                                                                                                                                                                                        |                          | —                                     |
| `CTP_CLIENT_SECRET`               | API client secret. **Required.** Keep it out of source control.                                                                                                                                                                                                     |                          | —                                     |
| `CTP_REGION`                      | Region host fragment; the API and auth URLs are derived from it.                                                                                                                                                                                                    | `us-central1.gcp`        | `europe-west1.gcp`                    |
| `CTP_API_URL` / `CTP_AUTH_URL`    | Explicit API / auth URLs, overriding `CTP_REGION`.                                                                                                                                                                                                                  |                          | Derived from the region               |
| `CTP_SCOPES`                      | Scopes requested for the token.                                                                                                                                                                                                                                     | `view_products:anyafinn` | The API client's own scopes           |
| `CTP_SLUG_LOCALE`                 | The one locale product slugs are read in — URLs aren't localized. Must be a key the project's slugs use (often `en`).                                                                                                                                               | `en`                     | `en`                                  |
| `CTP_PRICE_COUNTRY`               | Country for country-scoped prices.                                                                                                                                                                                                                                  | `GB`                     | The locale's region (`en-GB` → GB)    |
| `CTP_BRAND_ATTRIBUTES`            | Attribute(s) shown as the brand; first present wins.                                                                                                                                                                                                                | `manufacturer`           | `brand,designer`                      |
| `CTP_SHORT_DESCRIPTION_ATTRIBUTE` | Attribute holding the short (card) description. commercetools' own `description` is long-form and shows on the product page only, so without this attribute cards show no description.                                                                              | `summary`                | `shortDescription`                    |
| `CTP_PRODUCT_SEARCH`              | `off` skips commercetools Product Search. When the project has it active, listings run one small search per page instead of reading the whole catalogue; it is off by default in commercetools (Merchant Center → Settings → Project settings → Storefront Search). | `off`                    | Used when active, full read otherwise |
| `CTP_CACHE_TTL_SECONDS`           | How long the catalogue listing is reused. `0` disables. Product pages and carousels always read live.                                                                                                                                                               | `300`                    | `60`                                  |

Sale prices work the same from either source: a product carrying a higher "was" price beside its current one renders both — `compareAtAmount` on a CMS price, a discounted price in commercetools.

## Site namespacing

Delivery keys are namespaced by site: keys on the hub are `<site>/<path>`, so the `acme` site's `/about` page is the item keyed `acme/about` (the name never appears in URLs).

If you don't set `SITE_NAME`, the namespace is the fixture set's name — `FIXTURE_SET`, else `frontend-starter` — with or without a hub. `pnpm hub:import` applies exactly the same default when it seeds, so a hub carrying a single set agrees with its deployment out of the box. Offline, the namespace is always the set's name: the mock has no re-prefixing step, so `SITE_NAME` isn't read there.

Set it explicitly where the two would otherwise disagree — a hub carrying several sets, or a partner serving the starter set under their own name. The Environment Manager writes `SITE_NAME` and `FIXTURE_SET` together for exactly that reason: one says which namespace, the other which content, and a stale value in one silently re-targets the other.

Set `SITE_NAME` explicitly for a namespace that isn't a set's name (lowercase letters, digits, single hyphens — and pick it once: it's baked into every delivery key, so changing it later means re-keying all content).

## Registering a deployed site

To register a deployed site against a hub, open that hub's card in `env-manager`. There are two paths:

- **+ Add existing site** — records a site you've already deployed (any host): give it a URL, and the brand and site name it was deployed with. Left blank, they're recorded as the hub's defaults — the same fallback **+ Create Vercel site** applies — and the placeholders show what those are. Reference only; nothing is created or redeployed, so the record should match the deployment's own `SITE_NAME` and `NEXT_PUBLIC_BRAND`.
- **+ Create Vercel site** — provisions a new Vercel project from the values this hub already holds: it creates the project, pushes the runtime env vars, deploys `apps/web`, and records the resulting URL for you. Needs the [Vercel CLI](https://vercel.com/docs/cli) installed and logged in (`vercel login`); a preflight check guides you if not. Only non-secret runtime variables are pushed — the Amplience OAuth credentials are management-only and never leave your machine.

Either way, once a site is recorded it's added as a visualization option in the CMS whenever you next seed or sync that hub's content types, and as a [schedule preview](working-with-a-hub.md#schedule-preview) application whenever you next seed its settings.

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
