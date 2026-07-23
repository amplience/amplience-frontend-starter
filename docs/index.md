# Documentation

What Quadratic Lite is, how the recursive component engine works, and when to reach for it.

## What is Quadratic Lite?

Quadratic Lite is a composable, flexible Next.js frontend designed to demonstrate the full power of Amplience Dynamic Content — the "head" for your headless CMS. It renders any content you create in Amplience, works out of the box with minimal configuration, and adapts to your brand through design tokens.

## How it works

### The recursive component engine

Pages are content. A page item references slots, slots reference components, and components can nest other components. The renderer walks that tree recursively, dispatching each item on its `_meta.schema` to a registered component — so editors compose pages freely and the frontend keeps up, with no route-per-template code.

### Content-driven architecture

Everything the site needs lives in the CMS: page content, metadata, layout composition, and brand styling. URLs map directly to delivery keys (`/about` serves the item keyed `about`), so launching a page is a publish, not a deployment.

## Key benefits

- **Zero-deployment content management** — content, layouts, and styling managed entirely in the CMS
- **Maximum flexibility** — composable components and per-brand token overrides
- **Loud failures** — missing or malformed content renders a visible, branded failure card, never a blank page
- **Accelerator pace** — validate a content strategy in weeks rather than a custom-build quarter
