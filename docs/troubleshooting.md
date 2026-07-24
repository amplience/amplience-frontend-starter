[← Back](..)

# Troubleshooting

Common gotchas and how to resolve them. This page grows as issues surface.

## Minor pnpm noise

If you see a `[DEP0169] DeprecationWarning: url.parse()` line, that's coming from inside pnpm's own bundled code (not this project) — see [pnpm#9492](https://github.com/pnpm/pnpm/issues/9492). It's cosmetic; silence it by adding `export NODE_OPTIONS="--disable-warning=DEP0169"` to your shell profile.
