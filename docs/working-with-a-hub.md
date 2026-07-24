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

3. Give it a label and identifier (free text, just for your own reference)

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
pnpm hub:import          # imports schemas, content types, then fixture content (~1m45s end to end)

pnpm hub:wipe            # frees delivery keys, then clears content, content-types, schemas (~45s end to end)

pnpm hub:import:schemas  # only imports the schemas
```

`pnpm hub:import` is also how you push local changes to a hub you've already seeded — it updates in place rather than duplicating.

For the full walkthrough — prerequisites, repository IDs, verification steps, and publishing behaviour — see the [seeding runbook](runbooks/hub-setup.md).

## Next steps

- Deploy a frontend against your hub — see [Deploying a site](deploying.md).
