# Flow fixtures

Checked-in Amplience Workforce flows, hydrated per hub at push time (ADR-0023).

```sh
pnpm flows:pull <flowId>            # → flows/local/ (gitignored)
pnpm flows:pull <flowId> --shared   # → flows/ (checked in)
pnpm flows:pull --file ./export.json
pnpm flows:push                     # every fixture here
pnpm flows:push "<label>"
pnpm flows:push --dry-run           # resolve, print the payload, send nothing
```

⚠️ Run `listeners:push` first. A flow's `${listener:…}` resolves against the
listeners seeded there, and resolution refuses rather than guessing.

Flows are **not** part of `hub:import all`. The other steps are baseline
configuration every hub wants; which showcase flow belongs on which customer's
hub is a judgement made at demo-prep time.

## Two homes: checked in, and local

```
flows/            checked in — the showcase set, reviewed in a pull request
flows/local/      gitignored — pulled from a customer or sandbox hub
```

**A pull lands in `local/` unless you pass `--shared`.** Promoting a flow into
the repository is a deliberate act rather than the default, because a flow
pulled from a customer hub can carry their brand names in instruction prose —
and an extension instance's `env` can carry their credentials. Opting _in_ to
committing is the safe direction for a mistake.

`flows:push` reads both, because a locally-pulled flow is still one you want to
push. Identity is still the label, so **a label present in both homes is
refused** rather than resolved by precedence — "which copy won" is not a
question anyone should have to ask during a demo.

## What a fixture holds

A flow export mixes three kinds of content. A fixture keeps the first, drops the
second and rewrites the third.

|                  |                                                                                         |                                      |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| **authored**     | the graph, and the declaration of each non-built-in action type                         | checked in                           |
| **materialised** | the extension instances, releases and webhook listeners the source hub happened to have | dropped, rebuilt from the target hub |
| **tokenised**    | the few values that point at something hub-specific from inside the graph               | `${…}`                               |

Dropping the materialised half is what takes the Localize flow from 36KB to
15KB, and it is also the point: none of it is a choice anyone made.

⚠️ **`virtualActions` is mandatory.** It declares each action's type, and a flow
missing it is rejected with one `UNKNOWN_ACTION` per affected node. Only its
hub-bound half goes. Within each declaration, `label`, `description`, `category`
and `group` look like presentation but are load-bearing — a flow created without
them is refused.

⚠️ **Action and edge UUIDs are never regenerated.** `$interpolate` sources,
decision-rule paths and human-review field names all reference them.

## The tokens

| in the flow                         | becomes                                  | resolved from                        |
| ----------------------------------- | ---------------------------------------- | ------------------------------------ |
| `actions[].config.instanceId`       | `${extensionInstance:<label>@<version>}` | the target hub's extension instances |
| `actions[].config["amp:webhookId"]` | `${listener:<label>}`                    | the listeners seeded before flows    |
| `edges[].inputs.workflowStateId`    | `${status:<label>}`                      | the target hub's workflow states     |

Classified by **where a value sits, not what it looks like**: a 24-character
workflow-state id also matches the base64 character class, so a value's shape
cannot tell a repository id from a workflow state.

### Why the instance token names the instance, not the extension

A hub usually holds **several instances of the same extension**, differing by
version or by installation parameters — which hub the instance points at, which
repository it writes to. Picking the wrong one is one of the most common ways a
moved flow breaks, which is why a token that said only `${extensionInstance:<extension-id>}`
would be lossy on exactly the hubs that matter.

So the token carries the instance's own name: `Amplience Dynamic Content@2.2.0`,
a `label@version` handle. The export does not hand that over directly —
`data.instances[]` carries only `{ id, releaseId }`, and the only human-readable
name on the wire is the instance picker's own option title, at
`virtualActions[].config.schema.properties.instanceId.oneOf[].title`
(`"Amplience Dynamic Content (v2.2.0)"`). `flows:pull` reads it from there.

### The `extensionInstances` manifest

A handle alone cannot be resolved if the target hub names its instances
differently, so the fixture also carries a manifest beside the graph:

```json
"extensionInstances": {
  "Amplience Dynamic Content@2.2.0": {
    "extension": "RXh0ZW5zaW9uOmFhZTdkOGVi…",
    "sourceInstanceId": "RXh0ZW5zaW9uSW5zdGFuY2U6NDIyNDc5MWM…"
  }
}
```

Push resolves each handle in three tiers:

1. an instance on the target hub whose `label@version` matches the handle;
2. failing that, the **single** instance of the manifest's `extension` — if the
   target hub has exactly one, it is unambiguous;
3. failing that, refuse. Several instances of the extension and no handle match
   is precisely the case where guessing produces a flow that imports cleanly and
   fails at run time.

`sourceInstanceId` is kept for diagnostics only — it never resolves anything.

## Pushing one back

Resolution reads the same three sites the tokeniser wrote, rather than scanning
the JSON for `${…}`. Site-first is what made the pull direction safe, and the
reverse direction has the same problem plus one of its own: instruction text
written for a model may legitimately contain a `${…}`, and rewriting English is
not this step's job.

An unresolved token **throws**, naming the token and the hub, and the push
writes nothing. A half-resolved flow is the worst outcome available — it imports
cleanly and dies at run time, in front of whoever the demo was for.

`virtualActions`' hub-bound half is then rebuilt from **what the resolved graph
actually binds**, not from the whole registry. The source export lists a
different instance set per declaration — an action only offered by a newer
release appears against one instance where its neighbours list two — so "every
instance of this extension" would be wrong as often as right. Icons and release
schemas are not restored: the spike established that a flow creates without
either.

Identity on the way in is the **exact label**, and labels are not unique on a
hub — the spike created three under one label without complaint — so the count
has three branches: none creates, one updates in place by the flow's own id, and
two or more is refused rather than guessed at. Nothing is ever pruned.

Everything is resolved and planned before anything is sent, so a fixture that
cannot resolve stops the run rather than leaving half a set pushed.

Two things the push does to the graph:

- **Reviewer lists are emptied.** A `human-review` step carries user ids, and on
  another hub those ids make the Workforce UI _crash_ when the step is opened —
  not merely show a dangling reference.
- **`status` is never sent.** It is not part of the update mutation at all, so
  sending it on create would make a flow's enabled state depend on whether it
  happened to exist yet. A hub owns its own enabled state; the fixture's
  `status` records what the source hub had.

## What is deliberately left alone

- **Locales.** `inputs.locales` is a hub-ish choice, but `sourceLocale` and the
  decision rules that compare against `en-US` are flow logic. Rewriting one
  without the other breaks the flow, so for now none of them are touched.
- **Brand names in prose.** Instruction text to a model may name a customer.
  Rewriting English is not something this can do safely.
- **`Extension:` ids.** The same on every organization, and the join key the
  manifest's fallback tier depends on.
- **Anything else opaque** — a generation model, a brand voice. `flows:pull`
  lists what it left so each can be checked, rather than guessing and producing a
  flow that imports cleanly and fails at run time.

## Identity

The flow's **label**, matched exactly, including any `[Org]` marker. Labels are
not unique on a hub, so push creates on no match, updates on one, and refuses on
several rather than picking.
