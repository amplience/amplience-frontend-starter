[← Back](..)

# Working with a hub

By default Quadratic Lite serves the bundled fixtures offline. When you're ready to use real content, you can point local dev at an Amplience hub and push the Quadratic Lite content model and starter content to it.

## Connecting to a hub

Adding a hub takes about 50 seconds via the Environment Manager GUI.

### Prerequisites

- A Client ID & Secret with full Dynamic Content + DAM permissions for your hub (from Amplience support).

### Steps

1. Start the Environment Manager GUI\
   `pnpm env-manager`

2. Click **+ Add hub**

3. Give it a label (free text, just for your own reference)

4. Enter the Client ID and Client Secret you received from Amplience support

5. Click **Fetch hub details**

6. Review the details, then click **Add hub**

_Under the hood this stores the details in an untracked `quadratic.config.json` file and some `.env` variables. These are never committed to the repo, and you should be able to do everything you need through the GUI._

> [!TIP] Checking permissions
> If you hit permission errors — or just want to check before you start — use the **Check credentials** button.

Use the **Set active** buttons to switch the local dev server between the fixtures (default) and any hub you've added.

## Seeding & syncing content

Once a hub is added, push the Quadratic Lite content model and starter content to it (typically ~1 min 45 sec for a full set). You can do this from the Environment Manager GUI, or from the terminal:

```sh
pnpm hub:import          # imports settings, schemas, content types, extensions, webhooks, then fixture content (~1m45s end to end)

pnpm hub:wipe            # removes seeded webhooks, frees delivery keys, then clears content, content-types, schemas (~45s end to end)

pnpm hub:import:schemas  # only imports the schemas
```

`pnpm hub:import` is also how you push local changes to a hub you've already seeded — it updates in place rather than duplicating. There is no separate `push` command.

Each layer can be seeded on its own (`pnpm hub:import:settings`, `:types`, `:extensions`, `:webhooks`, `:content`), and every button in the GUI has a terminal equivalent — see the [command reference](commands.md) for the full list, the environment variables the scripts read, and a GUI ↔ terminal mapping table.

For the full walkthrough — prerequisites, repository IDs, verification steps, and publishing behaviour — see the [seeding runbook](runbooks/hub-setup.md).

## Webhooks

Publishing in the CMS updates Amplience's own delivery CDN straight away, but a
deployment that caches content has to be told. Quadratic Lite can seed the
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
