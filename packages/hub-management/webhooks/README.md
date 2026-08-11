# Webhook definitions

One JSON file per webhook, authored hub-independently: environment-specific
values are `${…}` tokens the seed resolves against the target hub and its
configured web apps at import time, the same convention `extensions/` uses.

| Token                  | Resolves to                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `${site:url}`          | the web app's origin, trailing slash stripped               |
| `${site:label}`        | the web app's label (falls back to its name, then its host) |
| `${hub}`               | the target hub name                                         |
| `${secret:revalidate}` | `AMPLIENCE_REVALIDATE_SECRET`                               |

**A definition is expanded once per configured web app** (`webApps` in
`quadratic.config.json`). One hub can feed several deployments and each holds
its own cache, so each needs its own webhook — which is why `${site:label}`
belongs in the label: it's what makes the resulting webhooks distinguishable,
and the label is the identity the seed matches on when re-running.

Every webhook this tooling creates is labelled `Quadratic — …`. The seed only
ever creates, updates or deletes webhooks carrying that prefix, so hand-made
webhooks on a shared hub are never touched.

## Why the Management API rather than dc-cli

`dc-cli webhook import` discards the two fields that make a webhook usable
against an authenticated endpoint: the top-level `secret` (the HMAC signing
key) and any header marked `"secret": true` — it filters those headers out
before the create call. Since `dc-management-sdk-js` is already a direct
dependency here and the Environment Manager already talks to the Management
API, the seed uses the SDK directly. That keeps secret headers intact (what
an Algolia-style integration webhook needs), makes `active: false`
expressible, and replaces dc-cli's mapping-file idempotency with matching on
the label — one less piece of state to lose.

Resolved definitions are never written to disk: a staged copy would put the
resolved secret in the working tree. Tokens are resolved in memory and sent
straight to the API.
