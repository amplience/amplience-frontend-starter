# Theme

`@amplience/quadratic-theme` owns the design-token contract from ADR-0002 — Styling strategy (see the project architecture docs). It exports one stylesheet:

```ts
import '@amplience/quadratic-theme/tokens.css'
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

The stub brands currently live alongside the defaults in [`src/tokens.css`](src/tokens.css) (`anyafinn`, `arbor-harvest`, `azure-harvest`, `culinary-supply-hub`); each doubles as a further worked example. Client-specific themes belong in the private repo (ADR-0004 — Public/private split) and are never committed here.

## Where the brand gets activated

- **The site** — `apps/web` sets `data-brand` on `<html>` from the `NEXT_PUBLIC_BRAND` env var (fallback: `default`, which matches no overlay and renders the plain `:root` values). See [the renderer README](../../apps/web/src/renderer/README.md#theming) for the deployment wiring and how to add a brand end to end.
- **Storybook** — the Brand toolbar dropdown in [`packages/components/.storybook/preview.tsx`](../components/.storybook/preview.tsx) sets the same attribute on the story root. A new brand added to `tokens.css` becomes previewable by adding one entry to that dropdown's `items` list.

## Conventions worth knowing

Component CSS always goes through a variable — `background: var(--color-primary)`, never a literal. Hard-coded colour or spacing values in a component `.module.css` are a code-review reject (ADR-0002 §4); the override model above only stays trivial while that holds.

Brands override the _shared_ token first (`--interactive-hover-*`) and reach for component-scoped tokens (`--card-hover-*`) only when one surface needs to differ — the shared token exists so a single line themes every interactive surface at once.
