[← Back](..)

# Theming

Every visual decision in Quadratic Lite resolves through a CSS custom property. Brands redefine those properties — in code, in the CMS, or both — and no component file changes.

## Two places theming can be managed

Quadratic Lite supports two ownership models, because teams differ in who owns the look and whether they have a deploy pipeline.

|                        | In code (`tokens.css`)    | In the CMS (custom CSS)                 |
| ---------------------- | ------------------------- | --------------------------------------- |
| Who edits it           | Developers, via a PR      | Content editors, in Dynamic Content     |
| Ships via              | A deployment              | A publish                               |
| Rendering              | Pure static               | ISR (a periodic content read)           |
| Versioned & reviewable | Yes, in git               | CMS revision history only               |
| Enabled by default     | Yes — this is the default | No — opt in with `AMPLIENCE_CUSTOM_CSS` |

The code path is the default and always available. The CMS path is additive: it layers on top of the tokens and is off unless a deployment asks for it.

Both models write ordinary CSS against the same two surfaces — the [token contract](#the-token-contract) and the [component theming hooks](#component-theming-hooks) — so a rule drafted in one place works unchanged in the other.

## The token contract

[`packages/theme/src/tokens.css`](../packages/theme/src/tokens.css) defines every design token as a CSS custom property on `:root`. `apps/web` imports it once at the layout root; components never import it — they just reference the variables.

| Family                                         | Covers                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `--font-body`, `--font-heading`, `--font-code` | font stacks (body applies to `<body>`, heading to `h1`–`h6`, code to `pre`)             |
| `--spacing`, `--spacing-0..10`, `--gap`        | base unit plus the derived spacing scale                                                |
| `--radius`                                     | base unit for border-radius                                                             |
| `--site-*`                                     | page-level layout — gutter, max-widths                                                  |
| `--color-*`                                    | semantic colours (primary/secondary/tertiary plus contrasts), grey ramp, status colours |
| `--button-*`                                   | button padding, radius, colour states                                                   |
| `--interactive-hover-*`                        | shared hover treatment for every interactive surface (cards, linked images, …)          |

The defaults are deliberately plain — system fonts, neutral greys, no radius, conservative spacing — so a brand **adds** its identity rather than stripping a house style first. It also means the accelerator renders clean and presentable with no brand applied at all.

Component CSS always goes through a variable: `background: var(--color-primary)`, never a literal. That discipline is what keeps the override model a handful of lines.

> [!IMPORTANT]
> The variable names in `tokens.css` are a public contract. Renaming one is a breaking change for every brand that overrides it, in this repo or a private one.

### Overriding tokens

A brand is a block of variable redefinitions scoped under a `[data-brand]` selector. Nothing else — no component files, no build configuration.

```css
[data-brand='acme'] {
  --font-heading: var(--nf-playfair-display), Georgia, serif;
  --color-primary: #ff6a00;
  --color-primary-contrast: #ffffff;
  --radius: var(--spacing);
  --button-border-radius: 100px;

  /* Lift on hover — one override themes every interactive surface */
  --interactive-hover-shadow: 0 8px 24px 0 rgb(0 0 0 / 0.14);
  --interactive-hover-transform: translateY(-2px);
}
```

Because CSS variables cascade by tree position, the overrides apply to everything inside the element carrying the attribute. `data-brand` sits on `<html>`, so the block above themes the whole document — and the same block works whether it lives in `tokens.css` or in a CMS custom-CSS field.

### Component-scoped tokens

Components define their own tokens too — `--card-*`, `--hero-*`, `--carousel-*`, `--logo-*` — documented per component in Storybook. Override the shared token first (`--interactive-hover-shadow` themes every surface at once) and reach for a component-scoped one (`--card-hover-shadow`) only when a single surface needs to differ.

The same mechanic works locally, without touching the global theme, because variables resolve by tree position:

```css
/* Everything inside this section uses half the spacing scale */
.section[data-density='compact'] {
  --spacing: 2px;
}
```

## Component theming hooks

Tokens cover most brand work, but not all of it — sometimes you need to reach a specific component. Every component's root element carries a stable, PascalCase class equal to its component name — `Hero`, `MediaCard`, `Container` — alongside its hashed CSS-module class:

```css
.MediaCard h2 {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

A guard test enforces that every component ships its hook, so it can't silently go missing. Combine a hook with a brand selector to scope it: `[data-brand='acme'] .MediaCard h2 { … }`.

> [!WARNING]
> Target the PascalCase hooks, never the hashed CSS-module class names — those are build output and change without notice. The hooks are a stable contract in the same sense as the token variables: renaming a component or moving its root is a breaking change for anyone theming against it.

## Branding in code

The default model: a brand's `[data-brand]` block lives in [`tokens.css`](../packages/theme/src/tokens.css) alongside the defaults, versioned and reviewed like any other change.

To use a web font, add it to [`packages/theme/src/fonts.ts`](../packages/theme/src/fonts.ts) — each font is exposed as a `--nf-*` variable that `tokens.css` then references, so the token layer never couples to `next/font` internals.

Nested rules are allowed for the cases variables can't reach — a brand-specific type scale, or a decorative pseudo-element — scoped inside the same `[data-brand]` block. The bundled `amplience` brand is the worked example.

### Activating a brand

- **The site** — `apps/web` sets `data-brand` on `<html>` from `NEXT_PUBLIC_BRAND`. Unset (or `default`) matches no overlay and renders the plain `:root` values. See [Deploying a site](deploying.md).
- **Storybook** — the **Brand** toolbar dropdown sets the same attribute on the story root. Add one entry to its `items` list in `packages/components/.storybook/preview.tsx` and a new brand becomes previewable. See [Storybook](storybook.md).

The reference brands (`amplience`, `anyafinn`, `arbor-harvest`, `azure-harvest`, `culinary-supply-hub`) live alongside the defaults in `tokens.css` and each doubles as a further example. Client-specific brands belong in a private repo and are never committed here.

## Custom CSS from the CMS

An optional layer of site-wide CSS, authored in Dynamic Content and injected on top of the design tokens. No code edit, no redeploy.

This exists for teams who want their **content editors** to own the styling. It comes into its own when branded sites are being stood up off the cuff — a temporary campaign site, a partner demo, a prospect's brand dropped onto a running deployment — where the brand is decided by the people producing the content and waiting on a release would defeat the point. It's equally handy for iterating on a look quickly before folding the result back into `tokens.css`.

### Enabling it

Set the flag in **both** the host environment and your local `.env` — there's no derivation, because the frontend is repository-agnostic and has nothing to infer it from:

```sh
AMPLIENCE_CUSTOM_CSS="TRUE"
```

When it's off, the frontend does no CMS read for it at all and the deployment stays pure-static. When it's on, the read is cached with an ISR window (`AMPLIENCE_CUSTOM_CSS_REVALIDATE`, default 300s). For instant updates on publish, point an Amplience webhook at `POST /api/revalidate-custom-css` with the shared secret in `AMPLIENCE_REVALIDATE_SECRET`. Local development reads live, so edits show immediately.

A missing or empty item injects nothing — never an error.

### Where it's authored

The item lives in the **Site Components** repository (API name `sitestructure`), separate from the content repository so "who may change site-wide CSS" has its own permissions — usually a smaller set than those editing pages. It's a single `custom-css` item with one `css` field, edited through a CSS editor extension, and it isn't a rendered component — it has no place in a page.

Its visualization renders the homepage with your CSS applied, live from the form, so you can see the effect before publishing.

### How it cascades

The CSS is injected as an ordinary stylesheet, **unlayered**, ordered after the tokens. So it behaves the way CSS already behaves in your head:

- it beats the token defaults at equal specificity, because it comes later
- it loses to a more specific component rule
- you escalate with ordinary specificity

It is deliberately _not_ wrapped in a `@layer` — cascade layers resolve before specificity, which would make an override either always win or always lose regardless of its selectors.

## Scoping custom CSS

One hub can serve several sites and several brands. Two scoping mechanisms compose.

### To a site, with delivery keys

Delivery keys are namespaced by site — `<site>/<path>` — and the custom-CSS item is no exception:

```
<site>/site/custom-css
```

So each site can have its own item, and the frontend reads whichever key matches its `SITE_NAME`. Two sites on the same hub can receive independent CSS, or equally you can add two keys to the same CSS item for it to apply to both sites. See [Site namespacing](deploying.md#site-namespacing).

### To a brand, with `[data-brand]`

Because `data-brand` sits on `<html>`, wrapping your rules in the same selector the code-managed brands use confines them to deployments running that brand:

```css
[data-brand='acme'] {
  --color-primary: #ff6a00;
}

[data-brand='contoso'] {
  --color-primary: #003366;
}
```

Rules outside any wrapper apply to every brand — useful for a site-wide tweak that shouldn't be brand-specific.

### Both together

Delivery keys pick which sites see an item; `[data-brand]` picks which brands within them it applies to. A single item can hold shared rules at the top level and brand-specific blocks beneath:

```css
/* Every brand on this site */
.Hero h1 {
  text-wrap: balance;
}

/* Only the acme deployments */
[data-brand='acme'] {
  --color-primary: #ff6a00;

  .Hero h1 {
    text-transform: uppercase;
  }
}
```

## Next steps

- [Deploying a site](deploying.md) — `NEXT_PUBLIC_BRAND`, `SITE_NAME`, and the rest of the environment
- [Storybook](storybook.md) — previewing a brand across every component
- [Working with a hub](working-with-a-hub.md) — seeding the repositories the custom-CSS item lives in
