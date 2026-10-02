[← Back](..)

# Troubleshooting

Common gotchas and how to resolve them. This page grows as issues surface.

## A wiped page still serves at its delivery key

Symptom: the content item is archived, has no delivery key, and a lookup by
**delivery id** correctly returns `CONTENT_NOT_FOUND` — but a lookup by
**delivery key** still serves it, from origin rather than cache.

The key has been orphaned. A delivery key is retracted by the unpublish, matched
on the key the item still holds at that moment, so removing the key from an item
that is still published strands it: the key goes on serving that item's last
published snapshot indefinitely. Nothing on the authoring side shows this — the
item reports no delivery key, and the orphan is only visible by requesting the
URL.

Unpublishing on its own is unaffected; a page taken down with its key intact
stops serving straight away.

To reclaim an orphaned key: add it to another content item, publish that item,
then unpublish it. Re-seeding does the same thing incidentally, since publishing
new content under the key overwrites the entry.

`hub:wipe` unpublishes before it strips keys, so it doesn't create these — but
hubs wiped by a version before 2 Oct 2026 may carry some.

## Minor pnpm noise

If you see a `[DEP0169] DeprecationWarning: url.parse()` line, that's coming from inside pnpm's own bundled code (not this project) — see [pnpm#9492](https://github.com/pnpm/pnpm/issues/9492). It's cosmetic; silence it by adding `export NODE_OPTIONS="--disable-warning=DEP0169"` to your shell profile.
