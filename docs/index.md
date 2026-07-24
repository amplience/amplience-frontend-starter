[← Back](..)

# The head for your headless CMS

Quadratic Lite is a demo-ready frontend that brings Amplience Dynamic Content to life — publish and go, no deployments.

## Why Quadratic exists

A headless CMS is powerful, but there's an inherent challenge: **how do you demonstrate a headless system without a head?** Content lives in Amplience Dynamic Content, beautifully structured and ready to deliver — but clients, stakeholders, and content teams need to _see_ how that content becomes a digital experience before investing in a custom frontend.

Quadratic is the answer: a composable, flexible Next.js frontend that renders any content you create in Amplience, works out of the box, and adapts to your brand through content-controlled styling.

### What that means in practice

- **Zero-deployment content management** — pages, navigation, styling, and layouts are all managed from the CMS. Publish and go.
- **Maximum flexibility** — composable components nest inside one another; one frontend serves infinite brand expressions.
- **An accelerator, not just a demo** — validate a content strategy in weeks, then keep building on the same foundation.

Quadratic Lite is the open-source distillation of those ideas: the same recursive, content-driven rendering engine, rebuilt lean.

## What exactly is Quadratic Lite?

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
