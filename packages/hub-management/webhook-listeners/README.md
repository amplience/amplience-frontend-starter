# Webhook listener fixtures

Workforce webhook listeners, seeded before the flows that reference them
(ADR-0023).

```sh
pnpm listeners:pull                 # every listener → local/ (gitignored)
pnpm listeners:pull --shared        # → webhook-listeners/ (checked in)
pnpm listeners:push                 # every fixture, from both homes
pnpm listeners:push "Trigger Localisation"
pnpm listeners:push --dry-run       # print the plan, change nothing
```

**Author these with `listeners:pull`, not by hand.** A flow's
`${listener:Label}` carries the label the _source hub_ uses, so a fixture whose
label was typed from memory seeds a listener no flow references — and the flow
still refuses. That has already happened once.

One JSON file per listener:

```json
{
  "label": "Trigger Localization",
  "schema": { "type": "object", "properties": { "payload": { … } } }
}
```

`schema` is held as real JSON so it diffs, and stringified at the call — the API
carries it as a string. Comparison is on meaning rather than text, so
reindenting a fixture does not produce a change on the next run.

## Two homes: checked in, and local

```
webhook-listeners/            checked in — reviewed in a pull request
webhook-listeners/local/      gitignored — pulled from a customer or sandbox hub
```

**A pull lands in `local/` unless you pass `--shared`.** Promoting a listener
into the repository is a deliberate act rather than the default. `listeners:push`
reads both, and **a label present in both homes is refused** rather than
resolved by precedence.

## Identity, and what is never touched

The **label**, matched exactly, is the identity — the same rule flows use, and
the thing `${listener:Label}` in a flow resolves against. Two listeners sharing
a label on one hub is refused rather than guessed at.

**Nothing is pruned.** A listener this tooling did not create may have external
callers pointed at its URL, so a listener no fixture mentions is left alone.

**An existing listener is updated in place**, by its own id, so its
Amplience-minted inbound URL survives a re-seed and those callers keep working.
That URL cannot be authored ahead of time, so the command prints it.

## ⚠️ Security: this step can only create unauthenticated listeners

A listener's security reads back as a `__typename` and nothing more — the HMAC
secret never comes out of the API. HMAC _can_ be set (`CreateWebhookListenerSecurityInput`
has an `hmac` member beside `none`), but it cannot be read, so a re-seed has
nothing to put back and would replace that protection with none, leaving the
endpoint open to anyone holding the URL.

**A listener that is not provably unauthenticated is refused and left
untouched**, and "not provably" includes a security shape this tooling has never
heard of. The same rule the webhooks step applies: never seed something
unauthenticated because its credential was unavailable.

Seeding an HMAC listener is possible in principle, from a secret supplied at
seed time rather than read back — the same rule the webhooks step applies to
`${secret:…}`. Nothing does that yet, so fixtures here describe unauthenticated
listeners only, and a protected listener is managed by hand.
