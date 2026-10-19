# Workforce extension catalogue

Extensions whose `extensionId` means the same thing on every hub — so a hub that
has never had one installed can get it without a GraphQL playground and a wiki
page (ADR-0023, QL-164).

```sh
pnpm extensions:push                        # install every entry here
pnpm extensions:push "Amplience Dynamic Content"
pnpm extensions:push --version 2.3.0        # pin a release
pnpm extensions:push --dry-run              # print the plan, send nothing
```

`flows:push` also reads this catalogue: a flow whose extension has no instance on
the target hub installs it first, rather than refusing. An extension that is
_not_ catalogued is never installed — its id is assumed to be per-hub, so it is
matched on its label instead, which is the one case this reports rather than
doing silently. See **Matching** below.

## ⚠️ What an entry asserts

Not "this extension is public" — **"this `extensionId` means the same extension
on every hub"**. The two get conflated and they are not the same thing. An
`Extension` belongs to a `cmsHub`, and what makes its id portable is
`visibility`, not who wrote it:

| visibility | id portable? |                                                                                                 |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `PUBLIC`   | yes          | one record, instanced from any hub — the standard Amplience ones                                |
| `UNLISTED` | yes          | likewise, just not advertised — a customer's own extension can be this                          |
| `PRIVATE`  | **no**       | usable only from its own hub; re-created elsewhere it is a different record with a different id |

So a customer-authored extension is not automatically out of scope. Only the
genuinely per-hub case is — and that is exactly the case resolution falls back to
matching on the label, because there is no stable id to use.

## Why a catalogue and not a pull

Because there is nothing to pull. Probed 15 Oct 2026: `Query` has **no list
field for extensions at all** — every field is a single-id lookup — so a live
catalogue is not merely unavailable, it is not expressible. Details under
**Adding an entry**.

An entry is therefore a handful of constants, taken from the extension's own
"How to install …" page in Confluence.

What it deliberately does not do is create extensions or releases.
`createExtensionRelease` takes the extension's **source files** — that is
publishing an integration, not configuring a hub, and it has no business in
demo-fleet tooling.

## `installable`

Recording an id and being able to install it are separate claims, and an entry
can make only the first:

```json
{ "label": "Salesforce B2C", "extensionId": "RXh0ZW5zaW9uOj…", "installable": false }
```

That says: the id is stable, classify it — but this repo has no install recipe,
whether because no release ids are on file or because nobody here holds the
credentials. `extensions:push` lists it and skips it; a flow that needs it gets a
refusal telling you to install it on the hub by hand, rather than one pointing at
a command that cannot help.

An entry with the flag must carry **neither** `releases` nor `env`. Nothing would
ever read them, and configuration that is quietly dead reads as a working recipe
to whoever opens the file next, so it is refused outright.

## `local/`

`workforce-extensions/local/` is gitignored, and read alongside the checked-in
entries by both commands. It is where a customer's own `UNLISTED` extension
belongs: their id, recorded so flows resolve against it on their hubs, without
the id reaching this repository. Same split as `flows/local/`.

An entry appearing in both homes is refused rather than resolved by precedence —
on a duplicate `extensionId`, because two entries cannot both describe one
extension, and on a duplicate label, because `extensions:push "<label>"` would
have no answer.

## ⚠️ Secrets

`env` carries credentials — a personal access token for Dynamic Content, an API
client id and secret for Content Hub. **Entries hold tokens, never values:**

| token            | resolves to                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `${secret:NAME}` | `NAME` from the environment, usually written by the Environment Manager |
| `${hub:id}`      | the target hub's Dynamic Content id                                     |
| `${hub:name}`    | the target hub's name                                                   |

They resolve in memory at install time and are never written to disk, the same
rule the webhooks step applies. A missing secret refuses the install rather than
creating an instance that cannot authenticate — that failure would otherwise
surface inside a flow at run time, which is the worst place to find it.

The Content Hub client needs the DAM permissions its install page lists; an
instance installed with a client that lacks them will authenticate and then fail
on the actions that matter.

## Labels, and why they are computed

An instance's label is whatever the person running the mutation typed, and the
wiki's own pages show three spellings of the same one — `Amplience Dynamic
Content`, `… (v2.2.0)` and `… (2.2.0)`. A flow references an instance by a
`label@version` handle, so this computes the label as `<label> (v<version>)`,
which parses back to the handle a fixture expects. Where no version is pinned,
the bare label is used.

## Matching: catalogued by id, everything else by label

Matching on the id is sound exactly when the id is portable, which is what an
entry here asserts. For anything uncatalogued, an id that misses proves nothing —
it may simply be a `PRIVATE` extension's per-hub id — so the label is all that is
left.

So `flows:push` passes this catalogue in as the set of ids _known to be stable_,
and resolution escalates:

|     | the hub has                                         | outcome                                                                                                                                                                                    |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | an instance whose `label@version` handle matches    | binds, silently                                                                                                                                                                            |
| 2   | exactly one instance of the fixture's `extensionId` | binds, warns the version or parameters may differ                                                                                                                                          |
| 3   | several instances of that extension                 | refuses, naming them                                                                                                                                                                       |
| 4   | none, and the id **is** catalogued here             | refuses: the id would have matched if the extension were here, so it is simply not installed — pointing at `extensions:push`, or at installing by hand when the entry is not `installable` |
| 5   | none, and the id is **not** catalogued              | nothing vouches for the id travelling — match on the label alone                                                                                                                           |

In case 5 the label is the only thing that travels between hubs. One instance
with that label binds, with a warning that nothing has verified it is the same
integration; several refuse; none refuses and says the extension has to exist on
the hub before a flow can bind to it.

⚠️ Adding an entry therefore changes behaviour as well as enabling an install: a
catalogued id that misses becomes "not installed" rather than "possibly per-hub".
Catalogue an id only if you believe it is `PUBLIC` or `UNLISTED` — and if you
have no recipe for it, add it with `"installable": false` rather than leaving it
out, so case 5's vaguer refusal is not what someone hits.

## Adding an entry

From the extension's "How to install the … Workforce Extension" page: take
`extensionId`, the `label` and `description`, each version's
`extensionReleaseId`, and the `env` keys — replacing every value with a token.

### ⚠️ There is no way to check an id against the API

Probed on 15 Oct 2026, and the answer is worse than "no directory":

- `Query` has **no list field for extensions at all**. All 68 fields are
  single-id lookups bar `assetSearch` and `assets`. There is nothing to
  enumerate, so a live catalogue is not possible.
- `extension(id:)` exists, but reading any real field off a public extension
  returns `Missing permission read on Hub 690c86099b1b6025758ce841` — both
  entries here live on that one Amplience-internal hub, which a presales PAT
  cannot read. So an id cannot be _verified_ either, only used.
- Worse, `extension(id: <anything>) { id }` echoes the id straight back, with no
  lookup at all. A resolve check that selects only `id` **always passes**,
  including for an id that does not exist. Do not write one.

Installing still works — `createExtensionInstance` references the extension
without reading it, which is why `extensions:push` is fine. But a wrong id here
fails at install time with a message about the extension, not about the entry.

The one check that does work is after the fact: install the extension on a hub
through the UI once, then read the instance's `extensionId` back off that hub's
registry — which is exactly what `extensions:push` already prints. Trust that
over any install page. The Salesforce B2C page currently lists what looks like
the Dynamic Content `extensionId`, which cannot be right.
