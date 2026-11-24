[← Back](..)

# Working with a hub

By default Amplience Frontend Starter serves the bundled fixtures offline. When you're ready to use real content, you can point local dev at an Amplience hub and push the content model and starter content to it.

## Connecting to a hub

Adding a hub takes about 50 seconds via the Environment Manager GUI.

### Prerequisites

- A Client ID & Secret with full CMS + DAM permissions for your hub (from Amplience support).

### Steps

1. Start the Environment Manager GUI\
   `pnpm env-manager`

2. Click **+ Add hub**

3. Give it a label (free text, just for your own reference)

4. Enter the Client ID and Client Secret you received from Amplience support

5. Click **Fetch hub details**

6. Review the details, then click **Add hub**

_Under the hood this stores the details in an untracked `amplience.config.json` file and some `.env` variables. These are never committed to the repo, and you should be able to do everything you need through the GUI._

> [!TIP] Checking permissions
> If you hit permission errors — or just want to check before you start — use the **Check credentials** button.

Use the **Set active** buttons to switch the local dev server between a fixture
set (the default, offline) and any hub you've added. Exactly one thing is active
at a time, and activating it writes both `.env` files — so the pages you see and
the hub the `hub:*` commands target can't drift apart. See
[Fixture sets](commands.md#fixture-sets) for what a set is.

## Seeding & syncing content

Once a hub is added, push the content model and starter content to it (typically ~1 min 45 sec for a full set). You can do this from the Environment Manager GUI, or from the terminal:

```sh
pnpm hub:import                 # settings, schemas, content types, extensions, webhooks, then fixture content (~1m45s end to end)
pnpm hub:import --set anyafinn  # seed a second fixture set alongside the first

pnpm hub:wipe                   # removes seeded webhooks, frees delivery keys, then clears content, content-types, schemas and every extension (~45s end to end)
pnpm hub:wipe:content           # content items only, leaving the model in place

pnpm hub:import:schemas         # only imports the schemas
```

Each layer can be seeded on its own, and each can be wiped on its own too —
`hub:wipe:content`, `:types`, `:schemas`, `:extensions`, `:webhooks`. The wipes
run in the reverse of the seed order and refuse while anything still depends on
them, naming the step to run first.

`pnpm hub:import` is also how you push local changes to a hub you've already seeded — it updates in place rather than duplicating. There is no separate `push` command.

Each layer can be seeded on its own (`pnpm hub:import:settings`, `:types`, `:extensions`, `:webhooks`, `:content`), and every button in the GUI has a terminal equivalent — see the [command reference](commands.md) for the full list, the environment variables the scripts read, and a GUI ↔ terminal mapping table.

For the full walkthrough — prerequisites, repository IDs, verification steps, and publishing behaviour — see the [seeding runbook](runbooks/hub-setup.md).

## Product pickers

Editors pick products on [Product Carousel](content-types.md#product-carousel-block) blocks with the eComm Toolkit product picker, in place of typing SKUs. Which picker depends on where the hub's products live, and `hub:import` sets it up (the schemas in the repo stay the same either way — the picker is added at import time):

- **Amplience PIM** (`ecomm-toolkit-amplience`) — every hub. It searches the hub's own [Product](content-types.md#product) content items as the signed-in editor, so it needs no credentials, and stores SKUs.
- **commercetools** (`ecomm-toolkit-commercetools`) — hubs with a `commercetools` block (below). It stores SKUs too, so a carousel's content reads the same whichever picker filled it.

Both run from the same extension app. The Product Carousel gets the picker for the hub's **main PIM** — "Hub's main PIM" in the Environment Manager's PIM details, saved as `"mainPim"` on the hub's entry in `amplience.config.json`:

- `"mainPim": "cms"` — the Amplience PIM picker.
- `"mainPim": "commercetools"` — the commercetools picker. Needs the hub's `commercetools` block; `hub:import` stops with an error without it.

The values are the same as a site's `PRODUCT_SOURCE` (see [Deploying](deploying.md#products)), and the main PIM should match the source of the sites the hub mainly serves: a carousel only renders products its site's source can find. Without `mainPim`, a hub with a `commercetools` block counts as commercetools and any other as the CMS — so set it explicitly on a hub that has commercetools settings only for its multi-PIM carousels.

### commercetools

A hub serving commercetools-backed sites can give editors the commercetools picker. Set it up in the Environment Manager under the hub's settings → **PIM details**: the commercetools project key, client ID and client secret, the hub's main PIM, and whether to enable multi-PIM carousels. Then run `pnpm hub:import` (or just `:schemas`, `:types` and `:extensions`).

The form saves them to the hub's entry under `environments` in `amplience.config.json`:

```json
{
  "name": "anyafinn",
  "commercetools": {
    "projectKey": "anyafinn",
    "clientId": "…",
    "clientSecret": "…",
    "region": "europe-west1.gcp",
    "language": "en"
  },
  "mainPim": "commercetools",
  "multiPimDemo": true
}
```

`projectKey`, `clientId` and `clientSecret` are all or nothing. `region` (default `europe-west1.gcp`) and `language` (the locale the picker searches and labels in, default `en`) aren't in the form; add them to the file by hand if you need them, and the form keeps them. The form always saves `mainPim` (described above); `multiPimDemo` is described below. The file is plain JSON, so no comments.

With the block present, `hub:import` seeds the `ecomm-toolkit-commercetools` extension with these credentials, for the Product Carousel when commercetools is the main PIM and for the multi-PIM carousel's commercetools list. Without it (or with any of the three required keys missing) that extension is skipped, so a CMS-only hub is unaffected.

- **Use a dedicated read-only API client.** The toolkit calls commercetools from the editor's browser, so its secret is visible to anyone who can edit content. Create an API client with only `view_published_products` and `view_categories` — not the site's own client.
- **The picker needs Product Projection Search.** The toolkit's search runs on commercetools' older Product Projection Search, which is deprecated and has to be active on the project. That's separate from the newer Product Search the site uses for listings (see [Deploying](deploying.md#commercetools)).
- **The commercetools picker finds products by SKU.** Each SKU it stores must exist in the project — the same rule the site applies when it renders the carousel.

`"multiPimDemo": true` also registers the [Multi-PIM Product Carousel](content-types.md#multi-pim-product-carousel-demo) — one product list per source, for demo hubs whose sites run on different product sources. Each list gets its own source's picker: Amplience PIM for the CMS list, commercetools for the commercetools list. It needs more than one PIM, so it's only seeded once the hub has commercetools details, and the Environment Manager only shows it ("Enable multi-PIM carousels"), along with the main PIM choice, from then on. Leave it off for a client's hub, so editors see a single carousel.

## Schedule preview

Amplience's **Preview** (from the planning calendar, the timeline or an edition)
shows the whole site as it will be at a chosen date and time, scheduled content
included. The settings seed registers one preview application per site — the
same `Web (…)` names as the visualizations — opening
`<site>/preview/{{vse.domain}}`.

- **It's an ordinary browse.** Every page, the menu and the blog listing are
  read from Amplience's virtual staging host for that moment, and links stay
  inside the preview. The address carries the preview, so live tabs open
  alongside it are unaffected.
- **Move the date in place.** The banner at the top has a date picker; picking
  a new moment reloads the same page as of then. **Exit preview** goes to the
  same page on the live site.
- **What doesn't time-travel.** Products from commercetools (only CMS products
  are scheduled content), and CMS-managed custom CSS, which stays live.

> [!WARNING] Treat preview links as private
> A preview URL contains the hub's staging host, which reads every scheduled
> and draft item on the hub at any date. Preview pages are `noindex` and send
> no Referer, but don't paste the link anywhere public.

Re-run `pnpm hub:import:settings` after registering a new site to add its
preview application.

## Webhooks

Publishing in the CMS updates Amplience's own delivery CDN straight away, but a
deployment that caches content has to be told. Frontend Starter can seed the
webhooks that do the telling: on publish, Amplience calls the deployment and
clears the affected cache, so an edit shows up on the next request instead of
waiting out a revalidation window.

Two things have to line up first, which is why this is the one resource that
isn't ready to seed the moment a hub is added:

- **A registered site.** A webhook needs somewhere to call, and one is created
  per site registered against the hub — each deployment holds its own cache. Seed
  a hub before you've deployed anything and the webhooks step is simply skipped.
- **A shared secret on both sides.** Set **Revalidate secret** on the hub
  environment (or `AMPLIENCE_REVALIDATE_SECRET` in
  `packages/hub-management/.env`), _and_ the same value on the deployment itself.
  The hub side alone produces a webhook that gets rejected on every call — so
  when the secret is unset, the seed skips the webhook rather than creating a
  broken one and telling you it worked.

So the usual order is: add the hub → [deploy a site](deploying.md) → set the
secret in both places → **Webhooks → Seed** (or `pnpm hub:import:webhooks`).

Only webhooks labelled `Quadratic — …` are ever touched, so anything you or
another integration created on the hub survives both a seed and a wipe. And
because a webhook is matched to the site it serves, removing a site removes its
webhook on the next sync — one never outlives the deployment it points at.

What the webhooks are used for today is the CMS-managed custom CSS; see
[Theming](theming.md#custom-css-from-the-cms).

> [!NOTE] Pulling _from_ a hub
> Sync runs one way: the repo is the source of truth for the content model, and
> `hub:import` pushes it to a hub. There is no `pull`, and no hub `backup` /
> `restore` — both are deferred (ADR-0012; requirements §1.3 lists them as
> nice-to-have). In practice: if you change a schema in the Amplience UI, mirror
> the change in the repo by hand, and recover a broken hub with `pnpm hub:wipe`
> followed by a re-seed rather than from a snapshot. See
> [Not yet available](commands.md#not-yet-available).

## Next steps

- Deploy a frontend against your hub — see [Deploying a site](deploying.md).
- Browse the full [command reference](commands.md).
