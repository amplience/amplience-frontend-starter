# Theme

`@amplience/frontend-starter-theme` owns the design-token contract from ADR-0002 — Styling strategy (see the project architecture docs). It exports one stylesheet:

```ts
import '@amplience/frontend-starter-theme/tokens.css'
```

`apps/web` imports it once, at the layout root. Components never import it directly — they just reference the variables it defines.

## The contract

[`src/tokens.css`](src/tokens.css) defines every token as a CSS custom property on `:root`. **The variable names are the binding public contract** between this repo and any brand implementation, private or public — renaming one is a breaking change for every consumer (ADR-0002 §5).

The default values are deliberately plain: system fonts, neutral greys, modest radii, conservative spacing. A brand _adds_ its identity on top; there is no baked-in look to strip away first. That's also why the accelerator renders clean and presentable with no brand applied at all.

Token families (current set — the file itself is the authoritative reference):

| Family                                  | Covers                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `--spacing`, `--spacing-0..10`, `--gap` | base unit + derived spacing scale (components use `calc()` multiples)                |
| `--radius`                              | base unit for border-radius scales                                                   |
| `--site-*`                              | page-level layout: gutter, max-widths                                                |
| `--color-*`                             | semantic colours (primary/secondary/tertiary + contrasts), grey ramp, status colours |
| `--button-*`                            | button padding, radius, colour states                                                |
| `--interactive-hover-*`                 | shared hover treatment for all interactive surfaces (cards, linked images, …)        |

Components also define component-scoped tokens (e.g. `--card-hover-*`, `--hero-*`) in their own `.module.css` files, documented per component. Those follow the same override mechanics described below; the globals here are the ones a brand will touch first.

## How a brand overrides tokens

A brand is a block of variable redefinitions scoped under a `[data-brand]` selector. Nothing more — no component files change, no build configuration changes. One worked example:

```css
[data-brand='acme'] {
  --color-primary: #ff6a00;
  --color-primary-contrast: #ffffff;
  --radius: var(--spacing);
  --button-border-radius: var(--radius);
  /* Lift on hover — shadow + slight float */
  --interactive-hover-shadow: 0 8px 24px 0 rgb(0 0 0 / 0.14);
  --interactive-hover-transform: translateY(-2px);
}
```

Because CSS variables cascade by tree position, the overrides apply to everything inside the element carrying the attribute — the renderer sets it on `<html>`, Storybook sets it on a story wrapper, and both get identical results from the same CSS.

The brands currently live alongside the defaults in [`src/tokens.css`](src/tokens.css): `amplience` and `anyafinn` are the ones the bundled fixture sets ship under (each set declares its own in `set.json`, so switching set switches the theme), and `arbor-harvest`, `azure-harvest` and `culinary-supply-hub` are stubs. Each doubles as a further worked example. Client-specific themes belong in the private repo (ADR-0004 — Public/private split) and are never committed here.

## Where the brand gets activated

- **The site** — `apps/web` sets `data-brand` on `<html>` from the `NEXT_PUBLIC_BRAND` env var (fallback: `default`, which matches no overlay and renders the plain `:root` values). See [the renderer README](../../apps/web/src/renderer/README.md#theming) for the deployment wiring and how to add a brand end to end.
- **Storybook** — the Brand toolbar dropdown in [`packages/components/.storybook/preview.tsx`](../components/.storybook/preview.tsx) sets the same attribute on the story root. A new brand added to `tokens.css` becomes previewable by adding one entry to that dropdown's `items` list.

## Conventions worth knowing

Component CSS always goes through a variable — `background: var(--color-primary)`, never a literal. Hard-coded colour or spacing values in a component `.module.css` are a code-review reject (ADR-0002 §4); the override model above only stays trivial while that holds.

Brands override the _shared_ token first (`--interactive-hover-*`) and reach for component-scoped tokens (`--card-hover-*`) only when one surface needs to differ — the shared token exists so a single line themes every interactive surface at once.

## Fonts

Brand fonts are defined in [`src/fonts.ts`](src/fonts.ts) with `next/font/local` and self-hosted from [`fonts/`](fonts/) — one folder per family, holding the Latin-subset `.woff2` file(s) and that family's licence.

**Why not `next/font/google`?** It downloads every family from Google during `next build`. With a dozen families, a single failed or rate-limited request — common on shared CI/Vercel build machines — fails the whole build with `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`. Self-hosting removes that network dependency entirely and pins font versions, so builds are reproducible.

**Variable fonts first.** Where a family has a variable cut, one file covers the whole weight axis (declared as a range, e.g. `weight: '100 900'`). Lato and Poppins have no variable cut, so they ship one static file per weight that's actually used.

### Licensing

The font files are third-party assets and are **not** covered by this repository's Apache 2.0 licence. Each family is distributed under its own licence, kept next to the files as `fonts/<family>/LICENSE`, which must stay with them:

| Family             | Licence    |
| ------------------ | ---------- |
| Cormorant Garamond | OFL 1.1    |
| IBM Plex Sans      | OFL 1.1    |
| Inter              | OFL 1.1    |
| JetBrains Mono     | OFL 1.1    |
| Jost               | OFL 1.1    |
| Lato               | OFL 1.1    |
| Montserrat         | OFL 1.1    |
| Playfair Display   | OFL 1.1    |
| Poppins            | OFL 1.1    |
| Public Sans        | OFL 1.1    |
| Roboto             | OFL 1.1    |
| Roboto Slab        | Apache 2.0 |

Both licences allow bundling and redistribution with software. The OFL's main conditions: keep the licence with the files, don't sell the fonts on their own, and don't ship a modified font under its original name (the unmodified Fontsource subsets used here are fine).

### Adding or refreshing a font

Files come from [Fontsource](https://fontsource.org/) (Google Fonts families, packaged on npm), currently at version 5.3.0:

1. `npm pack @fontsource-variable/<family>` (or `@fontsource/<family>` if no variable cut exists) in a scratch directory and extract it.
2. Copy `files/<family>-latin-wght-normal.woff2` (plus `-wght-italic` only if a brand uses italics) — or, for static families, `files/<family>-latin-<weight>-normal.woff2` per weight — into `fonts/<family>/`, along with `LICENSE`.
3. Add a `localFont({ ... })` entry in `src/fonts.ts` with a `--nf-<family>` variable and add it to `brandFonts`. The `weight` range comes from the package's `metadata.json` (`axes.wght`).
4. Add the family to the licence table above, and to the Google Fonts `@import` in `packages/components/.storybook/preview-globals.css` so Storybook matches.

To refresh an existing family, repeat steps 1–2 at the newer version. Google rarely changes these families, so this is only worth doing when a fix or new glyphs are needed.
