# Workforce extension catalogue

The public Amplience Workforce extensions, so a hub that has never had one
installed can get it without a GraphQL playground and a wiki page (ADR-0023).

```sh
pnpm extensions:push                        # install every entry here
pnpm extensions:push "Amplience Dynamic Content"
pnpm extensions:push --version 2.3.0        # pin a release
pnpm extensions:push --dry-run              # print the plan, send nothing
```

`flows:push` also reads this catalogue: a flow whose extension has no instance
on the target hub installs it first, rather than refusing. An extension that is
_not_ in the catalogue is never installed — it is treated as a custom one and
matched on its label instead, which is the one case this reports rather than
doing silently. See **Matching** below.

## Why a catalogue and not a pull

These are **public** extensions: one `extensionId` that is the same on every
hub, and a release id per version. So an entry is a handful of constants, taken
from the extension's own "How to install …" page in Confluence.

What it deliberately does not do is create extensions or releases.
`createExtensionRelease` takes the extension's **source files** — that is
publishing an integration, not configuring a hub, and it has no business in
demo-fleet tooling. A **custom** extension — one authored on a hub rather than
published by Amplience — is therefore not installable from here either. It still
resolves, though: see below.

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

## Matching: public by id, custom by label

An `Extension` belongs to a `cmsHub` and an `organization`. A **public**
extension has one record Amplience owns, so its `extensionId` is the same
everywhere and is the only identity worth matching on. A **custom** one is a
per-hub record: install the same integration on a second hub and it is a
different `Extension` with a different id. Matching a custom extension on its id
cannot work, and would silently fail on every hub but the one it came from.

So `flows:push` passes this catalogue's ids in as the set of ids _known to be
public_, and resolution escalates:

|     | the hub has                                         | outcome                                                                                    |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | an instance whose `label@version` handle matches    | binds, silently                                                                            |
| 2   | exactly one instance of the fixture's `extensionId` | binds, warns the version or parameters may differ                                          |
| 3   | several instances of that extension                 | refuses, naming them                                                                       |
| 4   | none, and the id **is** catalogued here             | refuses: the extension is public and simply not installed, so `extensions:push` can fix it |
| 5   | none, and the id is **not** catalogued              | treated as custom — match on the label alone                                               |

In case 5 the label is the only thing that travels between hubs. One instance
with that label binds, with a warning that nothing has verified it is the same
integration; several refuse; none refuses and says the extension has to exist on
the hub before a flow can bind to it.

⚠️ Adding an entry here therefore changes behaviour as well as enabling an
install: a catalogued id that misses becomes "not installed" rather than
"probably custom". Only catalogue extensions that really are public.

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
