[← Back](..)

# Content types

Amplience Frontend Starter ships a content model of 24 content types — seven renderable blocks, plus the smaller repeatable types that make up pages, navigation and site chrome. Every item carries its schema URI in `_meta.schema` and the recursive renderer dispatches on it, so this page is also the map from a content type to the component that draws it.

The model is registered in a hub by `pnpm hub:import` — see [Working with a hub](working-with-a-hub.md). Where things live:

|                                                  |                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Schemas                                          | [`packages/hub-management/content-type-schemas/schemas`](../packages/hub-management/content-type-schemas/schemas) |
| Type registrations (label, icon, visualisations) | [`packages/hub-management/content-types`](../packages/hub-management/content-types)                               |
| Icons                                            | [`packages/hub-management/icons`](../packages/hub-management/icons)                                               |
| Components + registry entries                    | [`packages/components/src`](../packages/components/src)                                                           |

Storybook links point at a hosted Storybook. If you are offline you can run storybook locally with `pnpm sb` (see [Storybook](storybook.md)) before visiting the equivalent links.

Every schema URI is prefixed `https://quadratic.amplience.com/v2/` — the tables below show the part after it.

## Contents

- [At a glance](#at-a-glance)
- [Blocks](#blocks) — the seven types a slot can hold
- [Pages](#pages) — routable content
- [Composition](#composition)
- [Header and footer](#header-and-footer)
- [Navigation](#navigation)
- [Site configuration](#site-configuration)
- [Shared partials](#shared-partials)

## At a glance

|                                                                                       | Type                                        | Group       | Component                      | Storybook                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------- | ----------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_hero?w=24)                | [Hero Block](#hero-block)                   | Block       | `HeroBlock`                    | [Organisms/HeroBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-heroblock--docs)         |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_markdown-block?w=24)      | [Rich Text Block](#rich-text-block)         | Block       | `MarkdownBlock`                | [Organisms/MarkdownBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-markdownblock--docs) |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_media?w=24)               | [Media Block](#media-block)                 | Block       | `MediaBlock`                   | [Organisms/MediaBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-mediablock--docs)       |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_media-card?w=24)          | [Card](#card)                               | Block       | `MediaCard`                    | [Molecules/MediaCard](https://quadratic-lite-components.vercel.app/?path=/docs/molecules-mediacard--docs)         |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_carousel?w=24)            | [Carousel Block](#carousel-block)           | Block       | `CarouselBlock`                | [Organisms/CarouselBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-carouselblock--docs) |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_columns?w=24)             | [Columns Block](#columns-block)             | Block       | `ColumnsBlock`                 | [Organisms/ColumnsBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-columnsblock--docs)   |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_grid?w=24)                | [Grid Block](#grid-block)                   | Block       | `GridBlock`                    | [Organisms/GridBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-gridblock--docs)         |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_page?w=24)                | [Page](#page)                               | Page        | `Page`                         | [Templates/Page](https://quadratic-lite-components.vercel.app/?path=/docs/templates-page--docs)                   |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_blog-article?w=24)        | [Blog Article](#blog-article)               | Page        | `BlogArticle`                  | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/slots_slot?w=24)                  | [Slot](#slot)                               | Composition | `Slot`                         | [Organisms/Slot](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-slot--docs)                   |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_header?w=24)              | [Header](#header)                           | Chrome      | `HeaderBlock`                  | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_header-row?w=24)          | [Header Row](#header-row)                   | Chrome      | `HeaderRow`                    | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_header-group?w=24)        | [Header Group](#header-group)               | Chrome      | `HeaderGroup`                  | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_footer?w=24)              | [Footer](#footer)                           | Chrome      | `FooterBlock`                  | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_footer-row?w=24)          | [Footer Row](#footer-row)                   | Chrome      | `FooterRow`                    | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_menu?w=24)                | [Menu](#menu)                               | Navigation  | `Menu`                         | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_menu-item?w=24)           | [Menu Item](#menu-item)                     | Navigation  | `MenuItem`                     | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_hierarchy-menu?w=24)      | [Hierarchy Menu](#hierarchy-menu)           | Navigation  | `Menu`                         | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_hierarchy-menu-item?w=24) | [Hierarchy Menu Item](#hierarchy-menu-item) | Navigation  | `MenuItem`                     | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_logo?w=24)                | [Logo](#logo)                               | Navigation  | `Logo`                         | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_icon-button?w=24)         | [Icon Button](#icon-button)                 | Navigation  | `IconButton`                   | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_menu-toggle-button?w=24)  | [Menu Toggle Button](#menu-toggle-button)   | Navigation  | `MenuToggleButton`             | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/content_locale-selector?w=24)     | [Locale Selector](#locale-selector)         | Navigation  | `LocaleSelector`               | —                                                                                                                 |
| ![](https://cdn.media.amplience.net/i/quadraticdemo/sitestructure_custom-css?w=24)    | [Custom CSS](#custom-css)                   | Site config | _n/a — injected by `apps/web`_ | —                                                                                                                 |

Each type's schema URI and repository are in its own section below. The icons are the published assets DC shows in the content library, served from Content Hub (`https://cdn.media.amplience.net/i/quadraticdemo/{type}`) with a `?w=` size parameter. The sources live in [`icons/svg`](../packages/hub-management/icons/svg) and [`icons/png`](../packages/hub-management/icons/png), and each type registration points at the CDN URL.

## Blocks

Blocks are the renderable sections of a page. All seven are members of the [Content Block](#content-block) union, which is what [slots](#slot), [columns](#columns-block), [grids](#grid-block) and [blog articles](#blog-article) accept — so any block goes anywhere a block is allowed, and nesting is the editor's choice rather than a per-container list.

Four fields recur across blocks, and mean the same thing everywhere: `backgroundColor` ([palette](#colour)), `maxWidth` and `gutter` ([container](#container)), and `sectionHeader` ([section header](#section-header)).

### Hero Block

![Hero Block icon](https://cdn.media.amplience.net/i/quadraticdemo/content_hero?w=48)

A leading banner — title, optional subtitle, image, and CTAs, with overlay and positioning controls.

- **Schema** [`content/hero`](../packages/hub-management/content-type-schemas/schemas/content_hero.json) · **Repository** `content`
- **Components** [`HeroBlock`](../packages/components/src/organisms/HeroBlock) (organism) → `Container`, `Typography`, `Button`, `ContentMedia`, `ArtDirectedMedia`
- **Storybook** [Organisms/HeroBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-heroblock--docs)
- **Authoring** four editor tabs — Foreground, Overlay, Background, Layout

| Field                     | Label                                      | Type                                         | Req | Notes                                                                                                                                              |
| ------------------------- | ------------------------------------------ | -------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preTitle`                | Pre-title                                  | [Localized string](#localisation)            |     |                                                                                                                                                    |
| `title`                   | Title                                      | [Localized string](#localisation)            | ✅  | Drives the `<h1>` and the section's accessible name                                                                                                |
| `subtitle`                | Subtitle                                   | [Localized string](#localisation)            |     |                                                                                                                                                    |
| `description`             | Description                                | [Localized string](#localisation)            |     |                                                                                                                                                    |
| `media`                   | Media                                      | [Media](#media)                              |     |                                                                                                                                                    |
| `mobileOverride`          | Mobile override                            | boolean                                      |     | Show a different image at ≤768px. Default `false`                                                                                                  |
| `mobileMedia`             | Mobile media                               | [Media](#media)                              |     | Required when `mobileOverride` is on. May use a different aspect ratio — each breakpoint reserves its own box, so only the matched image downloads |
| `ctas`                    | CTAs                                       | [Call To Action](#call-to-action)[]          |     |                                                                                                                                                    |
| `textColor`               | Text colour                                | [Palette](#colour)                           |     |                                                                                                                                                    |
| `contentPositionMobile`   | Content position (mobile)                  | `overlay` \| `above` \| `beneath`            |     | Where content sits relative to the image at ≤768px                                                                                                 |
| `contentPositionDesktop`  | Content position (desktop)                 | `overlay` \| `above` \| `beneath`            |     | Default `overlay`                                                                                                                                  |
| `heightBehaviour`         | Height behaviour                           | `flexible` \| `fitToContent` \| `fitToImage` |     | How height is determined when content overlays the image                                                                                           |
| `verticalPosition`        | Vertical position                          | `top` \| `center` \| `bottom`                |     | Default `top`                                                                                                                                      |
| `horizontalPosition`      | Horizontal position                        | `left` \| `center` \| `right`                |     | Extent and alignment of the content panel                                                                                                          |
| `textAlign`               | Text alignment                             | `left` \| `center` \| `right`                |     |                                                                                                                                                    |
| `overlayStyle`            | Overlay style                              | `gradient` \| `hard` \| `solid`              |     | Scrim drawn over the image. Default `gradient`                                                                                                     |
| `overlayColor`            | Overlay colour                             | [Palette](#colour)                           |     | Default `black`                                                                                                                                    |
| `overlayIntensity`        | Overlay intensity                          | number (0–100)                               |     | Scrim opacity, as a percentage                                                                                                                     |
| `backgroundColor`         | Background colour                          | [Palette](#colour)                           |     |                                                                                                                                                    |
| `contentWidth`            | Foreground content width (px)              | number                                       |     |                                                                                                                                                    |
| `contentPadding`          | Foreground content top+bottom padding (px) | number                                       |     |                                                                                                                                                    |
| `maxWidth`                | Max width                                  | [Max width](#container)                      |     | Constrains the content slot. Default `default`                                                                                                     |
| `minHeight` / `maxHeight` | Min / max height (px)                      | number                                       |     |                                                                                                                                                    |

### Rich Text Block

![Rich Text Block icon](https://cdn.media.amplience.net/i/quadraticdemo/content_markdown-block?w=48)

A markdown content section with optional CTAs.

- **Schema** [`content/markdown-block`](../packages/hub-management/content-type-schemas/schemas/content_markdown-block.json) · **Repository** `content`
- **Components** [`MarkdownBlock`](../packages/components/src/organisms/MarkdownBlock) (organism) → `Markdown`, `Container`, `Button`
- **Storybook** [Organisms/MarkdownBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-markdownblock--docs)

| Field             | Label             | Type                                | Req | Notes                                |
| ----------------- | ----------------- | ----------------------------------- | --- | ------------------------------------ |
| `content`         | Content           | Localized value                     | ✅  | Markdown source, standard CommonMark |
| `ctas`            | CTAs              | [Call To Action](#call-to-action)[] |     |                                      |
| `backgroundColor` | Background colour | [Palette](#colour)                  |     |                                      |
| `maxWidth`        | Max width         | [Max width](#container)             |     |                                      |
| `gutter`          | Gutter            | boolean                             |     | Inset content from the viewport edge |

### Media Block

![Media Block icon](https://cdn.media.amplience.net/i/quadraticdemo/content_media?w=48)

A standalone media section with optional caption and link. Supports DAM-backed (DynamicImage) or manually-authored (ManualImage) media.

- **Schema** [`content/media`](../packages/hub-management/content-type-schemas/schemas/content_media.json) · **Repository** `content`
- **Components** [`MediaBlock`](../packages/components/src/organisms/MediaBlock) (organism) → `ContentMedia` (`DynamicImage` / `ManualImage`), `Container`, `Typography`, `Link`
- **Storybook** [Organisms/MediaBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-mediablock--docs)

| Field             | Label             | Type                              | Req | Notes                                                      |
| ----------------- | ----------------- | --------------------------------- | --- | ---------------------------------------------------------- |
| `media`           | Media             | [Media](#media)                   | ✅  |                                                            |
| `caption`         | Caption           | [Localized string](#localisation) |     |                                                            |
| `href`            | Link              | string                            |     | Wraps the media in a link. External URLs open in a new tab |
| `fullBleed`       | Full bleed        | boolean                           |     | Edge-to-edge, ignoring container padding and max-width     |
| `backgroundColor` | Background colour | [Palette](#colour)                |     |                                                            |
| `maxWidth`        | Max width         | [Max width](#container)           |     | Ignored when full bleed is on                              |

### Card

![Card icon](https://cdn.media.amplience.net/i/quadraticdemo/content_media-card?w=48)

A card with an optional cover image, title, body copy, and a CTA. The workhorse of grids and carousels.

- **Schema** [`content/media-card`](../packages/hub-management/content-type-schemas/schemas/content_media-card.json) · **Repository** `content`
- **Components** [`MediaCard`](../packages/components/src/molecules/MediaCard) (molecule) → `Card`, `ContentMedia`, `Typography`, `Button`, `Link`
- **Storybook** [Molecules/MediaCard](https://quadratic-lite-components.vercel.app/?path=/docs/molecules-mediacard--docs)

| Field            | Label         | Type                                          | Req | Notes                                                       |
| ---------------- | ------------- | --------------------------------------------- | --- | ----------------------------------------------------------- |
| `title`          | Title         | [Localized string](#localisation)             | ✅  |                                                             |
| `description`    | Description   | [Localized string](#localisation)             |     |                                                             |
| `media`          | Media         | [Media](#media)                               |     |                                                             |
| `layout`         | Layout        | `above` \| `beside` \| `dynamic` \| `overlay` |     | Image and body arrangement                                  |
| `headingVariant` | Heading level | `h2`–`h6`                                     |     | Heading element for the card title                          |
| `elevation`      | Card Type     | `flat` \| `raised` \| `bordered`              |     |                                                             |
| `color`          | Card colour   | [Palette](#colour)                            |     |                                                             |
| `links.href`     | Card Link     | string                                        |     | Makes the whole card one link. When set, the CTA is ignored |

### Carousel Block

![Carousel Block icon](https://cdn.media.amplience.net/i/quadraticdemo/content_carousel?w=48)

A horizontally scrolling track of content items — cards, media, rich text or heroes, in any combination.

- **Schema** [`content/carousel`](../packages/hub-management/content-type-schemas/schemas/content_carousel.json) · **Repository** `content`
- **Components** [`CarouselBlock`](../packages/components/src/organisms/CarouselBlock) (organism) → `Carousel`, `SectionHeader`, `Container`
- **Storybook** [Organisms/CarouselBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-carouselblock--docs)

| Field                                       | Label                    | Type                              | Req | Notes                                                         |
| ------------------------------------------- | ------------------------ | --------------------------------- | --- | ------------------------------------------------------------- |
| `sectionHeader`                             | Section header           | [Section Header](#section-header) |     |                                                               |
| `items`                                     | Carousel Items           | [Carousel Item](#carousel-item)[] |     | One content item per slide, in scroll order. Mix types freely |
| `slidesMobile`                              | Slides visible (mobile)  | number                            |     | Below 769px. `1.2` leaves a sliver of the next slide showing  |
| `slidesTablet`                              | Slides visible (tablet)  | number                            |     | From 769px                                                    |
| `slidesDesktop`                             | Slides visible (desktop) | number                            |     | From 992px                                                    |
| `gap`                                       | Gap (px)                 | number                            |     |                                                               |
| `scrollStep`                                | Arrow step               | `slide` \| `page`                 |     |                                                               |
| `showArrows` / `showDots` / `showScrollbar` | Scroll affordances       | boolean                           |     |                                                               |
| `dragToScroll`                              | Drag to scroll           | boolean                           |     |                                                               |
| `backgroundColor`                           | Background colour        | [Palette](#colour)                |     |                                                               |
| `maxWidth`                                  | Max width                | [Max width](#container)           |     |                                                               |
| `gutter`                                    | Gutter                   | boolean                           |     | Off gives an edge-to-edge track                               |

Slides come from [Carousel Item](#carousel-item), not the wider [Content Block](#content-block) union — a carousel cannot be a slide of itself, because two nested horizontal scroll containers contend for the same drag and touch pan (ADR-0020).

### Columns Block

![Columns Block icon](https://cdn.media.amplience.net/i/quadraticdemo/content_columns?w=48)

A fixed, non-wrapping set of equal-width columns — each item occupies one column.

- **Schema** [`content/columns`](../packages/hub-management/content-type-schemas/schemas/content_columns.json) · **Repository** `content`
- **Components** [`ColumnsBlock`](../packages/components/src/organisms/ColumnsBlock) (organism) → `SectionHeader`, `Container`
- **Storybook** [Organisms/ColumnsBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-columnsblock--docs)

| Field             | Label              | Type                              | Req | Notes                                       |
| ----------------- | ------------------ | --------------------------------- | --- | ------------------------------------------- |
| `sectionHeader`   | Section header     | [Section Header](#section-header) |     |                                             |
| `items`           | Column Content     | [Content Block](#content-block)[] |     | One content item per column                 |
| `gap`             | Gap (px)           | number                            |     | Falls back to `var(--gap)` when empty       |
| `alignItems`      | Vertical alignment | `top` \| `center` \| `bottom`     |     | Alignment of column children within the row |
| `backgroundColor` | Background colour  | [Palette](#colour)                |     |                                             |
| `maxWidth`        | Max width          | [Max width](#container)           |     |                                             |
| `gutter`          | Gutter             | boolean                           |     |                                             |

### Grid Block

![Grid Block icon](https://cdn.media.amplience.net/i/quadraticdemo/content_grid?w=48)

A wrapping grid of content items — fixed columns per breakpoint, or auto-fit by minimum item width.

- **Schema** [`content/grid`](../packages/hub-management/content-type-schemas/schemas/content_grid.json) · **Repository** `content`
- **Components** [`GridBlock`](../packages/components/src/organisms/GridBlock) (organism) → `SectionHeader`, `Container`
- **Storybook** [Organisms/GridBlock](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-gridblock--docs)

| Field                                                | Label                  | Type                              | Req | Notes                                                                                           |
| ---------------------------------------------------- | ---------------------- | --------------------------------- | --- | ----------------------------------------------------------------------------------------------- |
| `sectionHeader`                                      | Section header         | [Section Header](#section-header) |     |                                                                                                 |
| `items`                                              | Grid Items             | [Content Block](#content-block)[] |     |                                                                                                 |
| `sizingMode`                                         | Sizing mode            | `fixed` \| `auto`                 |     | `fixed` — explicit column counts; `auto` — fit as many columns as the minimum item width allows |
| `columnsMobile` / `columnsTablet` / `columnsDesktop` | Columns per breakpoint | integer 1–6                       |     | Shown only when sizing mode is `fixed`                                                          |
| `minItemWidth`                                       | Min item width (px)    | number                            |     | Shown only when sizing mode is `auto`                                                           |
| `gap`                                                | Gap (px)               | number                            |     |                                                                                                 |
| `backgroundColor`                                    | Background colour      | [Palette](#colour)                |     |                                                                                                 |
| `maxWidth`                                           | Max width              | [Max width](#container)           |     |                                                                                                 |
| `gutter`                                             | Gutter                 | boolean                           |     |                                                                                                 |

## Pages

Routable content: head metadata plus an ordered list of [slots](#slot) the renderer composes. A URL maps to a delivery key, so launching a page is a publish rather than a deployment.

### Page

![Page icon](https://cdn.media.amplience.net/i/quadraticdemo/content_page?w=48)

A routable page — head metadata plus an ordered list of slots the renderer composes.

- **Schema** [`content/page`](../packages/hub-management/content-type-schemas/schemas/content_page.json) · **Repository** `content`
- **Components** [`Page`](../packages/components/src/templates/Page) (template) → [`Slot`](#slot) per entry, then whatever each slot holds
- **Storybook** [Templates/Page](https://quadratic-lite-components.vercel.app/?path=/docs/templates-page--docs)

| Field                                                  | Label         | Type                              | Req | Notes                                                                                |
| ------------------------------------------------------ | ------------- | --------------------------------- | --- | ------------------------------------------------------------------------------------ |
| `title`                                                | Title         | string                            |     | Document title — `<title>` and SEO                                                   |
| `description`                                          | Description   | string                            |     | Meta description — search snippets and social previews                               |
| `keywords`                                             | Keywords      | string[]                          |     | Low SEO weight today, but cheap to carry                                             |
| `social.title` / `social.description` / `social.image` | Social card   | string / string / [Media](#media) |     | Open Graph overrides. Unset fields fall back to the page's own title and description |
| `canonicalUrl`                                         | Canonical URL | string                            |     | Rarely set — defaults to the page's own route path                                   |
| `robots.noindex` / `robots.nofollow`                   | Robots        | boolean                           |     | Absent flags mean indexable and followable — editors opt out, never in               |
| `slots`                                                | Slots         | Content link → [Slot](#slot)[]    |     | Ordered slots composing the page body                                                |
| `_meta.deliveryKeys`                                   | Delivery keys | object                            |     | Variant keys namespaced by site: `{site}/{path}` (ADR-0014)                          |

### Blog Article

![Blog Article icon](https://cdn.media.amplience.net/i/quadraticdemo/content_blog-article?w=48)

A blog article page — editorial metadata plus an ordered list of slots the renderer composes.

- **Schema** [`content/blog-article`](../packages/hub-management/content-type-schemas/schemas/content_blog-article.json) · **Repository** `content`
- **Components** [`BlogArticle`](../packages/components/src/templates/BlogArticle) (template) → [`HeroBlock`](#hero-block), `Tags`, `Container`, `Icon`, then [`Slot`](#slot) per entry
- **Storybook** — no story yet

Shares the head-metadata shape with [Page](#page) (`title`, `description`, `keywords`, `social`, `canonicalUrl`, `robots`, `slots`, `_meta`), and adds:

| Field         | Label               | Type            | Req | Notes                                                                                       |
| ------------- | ------------------- | --------------- | --- | ------------------------------------------------------------------------------------------- |
| `coverImage`  | Cover Image         | [Media](#media) |     | Article header, and article cards on the archive page                                       |
| `author`      | Author              | string          |     | Display name                                                                                |
| `publishDate` | Publish Date        | string (date)   |     | ISO 8601, e.g. `2026-06-29`. Drives the displayed date and archive sort order               |
| `category`    | Category            | string          |     | Free-text label, e.g. "Getting Started". A managed DC content type is the natural next step |
| `tags`        | Tags                | string[]        |     | Topic tags — filtering and display                                                          |
| `readTime`    | Read Time (minutes) | number          |     |                                                                                             |

`_meta.deliveryKeys` follows the `{site}/blog/{slug}` convention.

## Composition

### Slot

![Slot icon](https://cdn.media.amplience.net/i/quadraticdemo/slots_slot?w=48)

An ordered list of component content the renderer recurses into. The join between a page and its blocks, and a DC slot rather than a content item — so the same page can carry different content per edition or variant.

- **Schema** [`slots/slot`](../packages/hub-management/content-type-schemas/schemas/slots_slot.json) · **Repository** `slots`
- **Components** [`Slot`](../packages/components/src/organisms/Slot) (organism) — dispatches each child on its `_meta.schema`
- **Storybook** [Organisms/Slot](https://quadratic-lite-components.vercel.app/?path=/docs/organisms-slot--docs)

| Field                | Label         | Type                              | Req | Notes                                    |
| -------------------- | ------------- | --------------------------------- | --- | ---------------------------------------- |
| `components`         | Components    | [Content Block](#content-block)[] |     | Ordered components rendered in this slot |
| `_meta.deliveryKeys` | Delivery keys | object                            |     |                                          |

## Header and footer

Site chrome is content too: a header or footer holds rows, and rows hold logos, menus and buttons. Rows are what let one header carry a logo bar above a nav bar without a schema change.

### Header

![Header icon](https://cdn.media.amplience.net/i/quadraticdemo/content_header?w=48)

Site header — one or more rows of navigation content.

- **Schema** [`content/header`](../packages/hub-management/content-type-schemas/schemas/content_header.json) · **Repository** `content`
- **Components** [`HeaderBlock`](../packages/components/src/organisms/HeaderBlock) (organism) → `Container`, then [Header Row](#header-row) per entry
- **Storybook** — no story yet

| Field                | Label         | Type                                       | Req | Notes                                                 |
| -------------------- | ------------- | ------------------------------------------ | --- | ----------------------------------------------------- |
| `rows`               | Header rows   | Content link → [Header Row](#header-row)[] |     | Ordered, e.g. logo row then nav row                   |
| `sticky`             | Sticky        | boolean                                    |     | Fixes the header to the top of the viewport on scroll |
| `maxWidth`           | Max width     | [Max width](#container)                    |     | Passed to child Containers                            |
| `_meta.deliveryKeys` | Delivery keys | object                                     |     |                                                       |

### Header Row

![Header Row icon](https://cdn.media.amplience.net/i/quadraticdemo/content_header-row?w=48)

A single horizontal row within the header — contains logos, menus, and icon buttons.

- **Schema** [`content/header-row`](../packages/hub-management/content-type-schemas/schemas/content_header-row.json) · **Repository** `content`
- **Components** [`HeaderRow`](../packages/components/src/organisms/HeaderBlock/HeaderRow.tsx) (organism) → `Container`
- **Storybook** — no story yet

| Field             | Label             | Type               | Req | Notes                                                                                                                                 |
| ----------------- | ----------------- | ------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `items`           | Items             | Content link[]     |     | [Logo](#logo), [Menu](#menu), [Icon Button](#icon-button), [Menu Toggle Button](#menu-toggle-button) or [Header Group](#header-group) |
| `backgroundColor` | Background colour | [Palette](#colour) |     |                                                                                                                                       |

### Header Group

![Header Group icon](https://cdn.media.amplience.net/i/quadraticdemo/content_header-group?w=48)

A grouping wrapper for header items — keeps its children visually together within a space-between row.

- **Schema** [`content/header-group`](../packages/hub-management/content-type-schemas/schemas/content_header-group.json) · **Repository** `content`
- **Components** [`HeaderGroup`](../packages/components/src/organisms/HeaderBlock/HeaderGroup.tsx) (organism)
- **Storybook** — no story yet

| Field   | Label | Type           | Req | Notes                                                                                                  |
| ------- | ----- | -------------- | --- | ------------------------------------------------------------------------------------------------------ |
| `items` | Items | Content link[] |     | [Logo](#logo), [Menu](#menu), [Icon Button](#icon-button) or [Menu Toggle Button](#menu-toggle-button) |

### Footer

![Footer icon](https://cdn.media.amplience.net/i/quadraticdemo/content_footer?w=48)

Site footer — one or more rows of navigation content.

- **Schema** [`content/footer`](../packages/hub-management/content-type-schemas/schemas/content_footer.json) · **Repository** `content`
- **Components** [`FooterBlock`](../packages/components/src/organisms/FooterBlock) (organism) → `Container`, then [Footer Row](#footer-row) per entry
- **Storybook** — no story yet

| Field                | Label         | Type                                       | Req | Notes                                          |
| -------------------- | ------------- | ------------------------------------------ | --- | ---------------------------------------------- |
| `rows`               | Footer rows   | Content link → [Footer Row](#footer-row)[] |     |                                                |
| `sticky`             | Sticky        | boolean                                    |     | Fixes the footer to the bottom of the viewport |
| `maxWidth`           | Max width     | [Max width](#container)                    |     | Passed to child Containers                     |
| `_meta.deliveryKeys` | Delivery keys | object                                     |     |                                                |

### Footer Row

![Footer Row icon](https://cdn.media.amplience.net/i/quadraticdemo/content_footer-row?w=48)

A single horizontal row within the footer — contains logos, menus, and icon buttons.

- **Schema** [`content/footer-row`](../packages/hub-management/content-type-schemas/schemas/content_footer-row.json) · **Repository** `content`
- **Components** [`FooterRow`](../packages/components/src/organisms/FooterBlock/FooterRow.tsx) (organism) → `Container`
- **Storybook** — no story yet

| Field             | Label             | Type               | Req | Notes                                                         |
| ----------------- | ----------------- | ------------------ | --- | ------------------------------------------------------------- |
| `items`           | Items             | Content link[]     |     | [Logo](#logo), [Menu](#menu) or [Header Group](#header-group) |
| `backgroundColor` | Background colour | [Palette](#colour) |     |                                                               |

## Navigation

The small, repeatable pieces. Menus come in two flavours that render identically — [Menu](#menu) with an inline array of items, and [Hierarchy Menu](#hierarchy-menu) authored in DC's tree UI — so the choice is an authoring preference, not a rendering one.

### Menu

![Menu icon](https://cdn.media.amplience.net/i/quadraticdemo/content_menu?w=48)

A navigation menu — a hierarchy of menu items.

- **Schema** [`content/menu`](../packages/hub-management/content-type-schemas/schemas/content_menu.json) · **Repository** `content`
- **Components** [`Menu`](../packages/components/src/organisms/Menu) (organism) → [`MenuItem`](#menu-item) per entry
- **Storybook** — no story yet

| Field             | Label                                   | Type                                                 | Req | Notes                                                                                   |
| ----------------- | --------------------------------------- | ---------------------------------------------------- | --- | --------------------------------------------------------------------------------------- |
| `items`           | Menu items                              | Content link → [Menu Item](#menu-item)[]             |     |                                                                                         |
| `useMobileLayout` | Use mobile menu layout on small screens | boolean                                              |     | Collapses into a hamburger drawer — pair with [Menu Toggle Button](#menu-toggle-button) |
| `display`         | Display mode                            | `dropdownOnHover` \| `megaMenuOnHover` \| `megaMenu` |     | Default top-nav, wide panel on hover, or always-open panel                              |

### Menu Item

![Menu Item icon](https://cdn.media.amplience.net/i/quadraticdemo/content_menu-item?w=48)

A single item in a navigation menu — with an optional link and optional child items.

- **Schema** [`content/menu-item`](../packages/hub-management/content-type-schemas/schemas/content_menu-item.json) · **Repository** `content`
- **Components** [`MenuItem`](../packages/components/src/molecules/MenuItem) (molecule) → `Link`, `Icon`
- **Storybook** — no story yet

| Field        | Label       | Type                          | Req | Notes                          |
| ------------ | ----------- | ----------------------------- | --- | ------------------------------ |
| `label`      | Label       | string                        | ✅  | Display text                   |
| `link`       | Link        | string                        |     | Omit for parent-only items     |
| `icon`       | Icon        | [Icon name](#icon)            |     | Shown alongside the label      |
| `visibility` | Visibility  | `mobileOnly` \| `desktopOnly` |     | Unset shows at all breakpoints |
| `children`   | Child items | Content link → Menu Item[]    |     | Nested items                   |

### Hierarchy Menu

![Hierarchy Menu icon](https://cdn.media.amplience.net/i/quadraticdemo/content_hierarchy-menu?w=48)

A navigation menu managed as an Amplience hierarchy — editors get a native tree UI for authoring nested items. Functionally equivalent to [Menu](#menu); the difference is authoring experience only.

- **Schema** [`content/hierarchy-menu`](../packages/hub-management/content-type-schemas/schemas/content_hierarchy-menu.json) · **Repository** `content` · also a `hierarchy-node`
- **Components** [`Menu`](../packages/components/src/organisms/Menu) (organism, shared with [Menu](#menu)) → [`MenuItem`](#hierarchy-menu-item) per node
- **Storybook** — no story yet

| Field                | Label                                   | Type                                                 | Req | Notes |
| -------------------- | --------------------------------------- | ---------------------------------------------------- | --- | ----- |
| `useMobileLayout`    | Use mobile menu layout on small screens | boolean                                              |     |       |
| `display`            | Display mode                            | `dropdownOnHover` \| `megaMenuOnHover` \| `megaMenu` |     |       |
| `_meta.deliveryKeys` | Delivery keys                           | object                                               |     |       |

No `items` array — children come from the hierarchy tree.

### Hierarchy Menu Item

![Hierarchy Menu Item icon](https://cdn.media.amplience.net/i/quadraticdemo/content_hierarchy-menu-item?w=48)

A single node in a Hierarchy Menu. Child items are managed by DC's hierarchy tree UI, so there is no inline children array.

- **Schema** [`content/hierarchy-menu-item`](../packages/hub-management/content-type-schemas/schemas/content_hierarchy-menu-item.json) · **Repository** `content` · also a `hierarchy-node`
- **Components** [`MenuItem`](../packages/components/src/molecules/MenuItem) (molecule, shared with [Menu Item](#menu-item)) → `Link`, `Icon`
- **Storybook** — no story yet

| Field        | Label      | Type                          | Req | Notes                                |
| ------------ | ---------- | ----------------------------- | --- | ------------------------------------ |
| `label`      | Label      | string                        | ✅  |                                      |
| `link`       | Link       | string                        |     | Omit for parent-only category labels |
| `icon`       | Icon       | [Icon name](#icon)            |     |                                      |
| `visibility` | Visibility | `mobileOnly` \| `desktopOnly` |     |                                      |

### Logo

![Logo icon](https://cdn.media.amplience.net/i/quadraticdemo/content_logo?w=48)

A brand logo — an image with an optional link.

- **Schema** [`content/logo`](../packages/hub-management/content-type-schemas/schemas/content_logo.json) · **Repository** `content`
- **Components** [`Logo`](../packages/components/src/molecules/Logo) (molecule) → `ContentMedia`, `Link`
- **Storybook** — no story yet

| Field   | Label | Type            | Req | Notes         |
| ------- | ----- | --------------- | --- | ------------- |
| `image` | Image | [Media](#media) | ✅  |               |
| `link`  | Link  | string          |     | Typically `/` |

### Icon Button

![Icon Button icon](https://cdn.media.amplience.net/i/quadraticdemo/content_icon-button?w=48)

A clickable icon from the design system's icon set.

- **Schema** [`content/icon-button`](../packages/hub-management/content-type-schemas/schemas/content_icon-button.json) · **Repository** `content`
- **Components** [`IconButton`](../packages/components/src/molecules/IconButton) (molecule) → `Icon`, `Link`
- **Storybook** — no story yet

| Field        | Label            | Type                          | Req | Notes                                            |
| ------------ | ---------------- | ----------------------------- | --- | ------------------------------------------------ |
| `icon`       | Icon             | [Icon name](#icon)            | ✅  |                                                  |
| `label`      | Accessible label | string                        | ✅  | Screen reader label — required for accessibility |
| `link`       | Link             | string                        |     |                                                  |
| `visibility` | Visibility       | `mobileOnly` \| `desktopOnly` |     |                                                  |

### Menu Toggle Button

![Menu Toggle Button icon](https://cdn.media.amplience.net/i/quadraticdemo/content_menu-toggle-button?w=48)

The hamburger button that opens and closes the mobile menu drawer. Place it in the header alongside the menu — it toggles every menu on the page using the mobile layout.

- **Schema** [`content/menu-toggle-button`](../packages/hub-management/content-type-schemas/schemas/content_menu-toggle-button.json) · **Repository** `content`
- **Components** [`MenuToggleButton`](../packages/components/src/molecules/MenuToggleButton) (molecule) → [`IconButton`](#icon-button)
- **Storybook** — no story yet

| Field   | Label            | Type   | Req | Notes               |
| ------- | ---------------- | ------ | --- | ------------------- |
| `label` | Accessible label | string |     | Screen reader label |

### Locale Selector

![Locale Selector icon](https://cdn.media.amplience.net/i/quadraticdemo/content_locale-selector?w=48)

A locale switcher for the header or footer. Shows a dropdown of the site's languages and takes visitors to the current page in the language they choose. Renders nothing when the site serves only one language.

- **Schema** [`content/locale-selector`](../packages/hub-management/content-type-schemas/schemas/content_locale-selector.json) · **Repository** `content`
- **Components** [`LocaleSelector`](../packages/components/src/molecules/LocaleSelector) (molecule)
- **Storybook** — no story yet

| Field   | Label            | Type   | Req | Notes                               |
| ------- | ---------------- | ------ | --- | ----------------------------------- |
| `label` | Accessible label | string |     | Screen reader label for the control |

## Site configuration

### Custom CSS

![Custom CSS icon](https://cdn.media.amplience.net/i/quadraticdemo/sitestructure_custom-css?w=48)

Optional site-wide custom CSS. When the deployment opts in with `AMPLIENCE_CUSTOM_CSS="TRUE"`, it is injected after the design tokens as an override — so a team that owns site config can add brand overrides without editing or redeploying `tokens.css`.

- **Schema** [`sitestructure/custom-css`](../packages/hub-management/content-type-schemas/schemas/sitestructure_custom-css.json) · **Repository** `sitestructure`
- **Components** none — consumed by [`apps/web/app/layout.tsx`](../apps/web/app/layout.tsx); see [Theming](theming.md)
- **Storybook** — n/a

| Field                | Label         | Type   | Req | Notes                                                                 |
| -------------------- | ------------- | ------ | --- | --------------------------------------------------------------------- |
| `css`                | Custom CSS    | string |     | Raw CSS, injected after `tokens.css` and any `[data-brand]` overrides |
| `_meta.deliveryKeys` | Delivery keys | object |     |                                                                       |

## Shared partials

Partials are not content types — they are schema fragments referenced by the types above, so a shape used in several places is maintained once. They live in [`content-type-schemas/schemas/partials_*.json`](../packages/hub-management/content-type-schemas/schemas) and are registered as content type schemas without a matching content type registration.

### Media

[`partials/media`](../packages/hub-management/content-type-schemas/schemas/partials_media.json) — one media field covering both sources, switched by `mediaType`:

| `mediaType`              | Fields                                                                                                                                                                                                                                              | Rendered by    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `DynamicImage` (default) | `image` — DAM `image-link` plus `crop`, `poi`, `rot`, `hue`, `sat`, `bri`, `fliph`, `flipv`, `aspectLock`, `query`, and the extension-written `width`, `height`, `aspectRatio`; `imageAltText` auto-populated from the asset for the current locale | `DynamicImage` |
| `ManualImage`            | `image.src`, `image.alt`, `image.width`, `image.height` (all required) plus optional `image.aspectRatio`                                                                                                                                            | `ManualImage`  |

The delivered `width`/`height`/`aspectRatio` are written by the media extension so the frontend can reserve layout space without a second call — which is what keeps images from shifting the page as they load.

### Call To Action

[`partials/cta`](../packages/hub-management/content-type-schemas/schemas/partials_cta.json) — a button-style link, rendered by the `Button` atom.

| Field     | Label          | Type                              | Req |
| --------- | -------------- | --------------------------------- | --- |
| `label`   | CTA Text       | [Localized string](#localisation) | ✅  |
| `href`    | CTA Link       | string                            | ✅  |
| `variant` | Button Variant | `text` \| `solid` \| `outlined`   |     |
| `color`   | Button Colour  | [Button palette](#colour)         |     |

### Colour

[`partials/colour`](../packages/hub-management/content-type-schemas/schemas/partials_colour.json) — the design-token colour choices offered to authors, so every schema surfacing a colour draws from the same palette as the [theme tokens](theming.md).

| Definition       | Values                                                                |
| ---------------- | --------------------------------------------------------------------- |
| `palette`        | `primary`, `secondary`, `tertiary`, `light`, `dark`, `black`, `white` |
| `button-palette` | `primary`, `secondary`, `tertiary`, `black`, `white`                  |

### Container

[`partials/container`](../packages/hub-management/content-type-schemas/schemas/partials_container.json) — the `Container` atom's authoring contract, referenced property-by-property by the blocks that wrap their content in one.

| Definition  | Values                              |
| ----------- | ----------------------------------- |
| `max-width` | `narrow`, `default`, `wide`, `none` |
| `gutter`    | boolean                             |

### Icon

[`partials/icon`](../packages/hub-management/content-type-schemas/schemas/partials_icon.json) — the curated icon set the `Icon` atom renders; names and order mirror the component's registry. Browse them in [Atoms/Icon](https://quadratic-lite-components.vercel.app/?path=/docs/atoms-icon--docs).

`calendar`, `clock`, `menu`, `x`, `chevron-up`, `chevron-down`, `chevron-left`, `chevron-right`, `arrow-left`, `arrow-right`, `search`, `filter`, `sliders`, `layout-grid`, `list`, `eye`, `plus`, `minus`, `user`, `log-in`, `log-out`, `shopping-cart`, `cart`, `shopping-bag`, `heart`, `tag`, `credit-card`, `package`, `truck`, `map-pin`, `trash`, `share`, `star`, `check`, `check-circle`, `alert-circle`, `info`

### Section Header

[`partials/section-header`](../packages/hub-management/content-type-schemas/schemas/partials_section-header.json) — the optional `title`, `subtitle` and `description` rendered above a block's content, all [localized strings](#localisation). Grouped as one object definition, so the fields stay together in the editor and the delivered object spreads straight into the [`SectionHeader`](https://quadratic-lite-components.vercel.app/?path=/docs/molecules-sectionheader--docs) molecule.

### Carousel Options

[`partials/carousel-options`](../packages/hub-management/content-type-schemas/schemas/partials_carousel-options.json) — the `Carousel` molecule's presentation contract: `slides-per-view`, `gap`, `scroll-step` (`slide` \| `page`), `show-arrows`, `show-dots`, `show-scrollbar`, `drag-to-scroll`. Held separately because more than one content type renders through the same molecule (ADR-0020), so a new option is one edit rather than several.

### Content Block

[`partials/content-blocks`](../packages/hub-management/content-type-schemas/schemas/partials_content-blocks.json) — a content link narrowed to the renderable [blocks](#blocks): [Carousel](#carousel-block), [Columns](#columns-block), [Grid](#grid-block), [Hero](#hero-block), [Rich Text](#rich-text-block), [Media](#media-block), [Card](#card). Referenced by slots, columns, grids and blog articles, so the allowed set is maintained in one place.

### Carousel Item

[`partials/carousel-items`](../packages/hub-management/content-type-schemas/schemas/partials_carousel-items.json) — a deliberately narrower union for carousel slides: [Card](#card), [Media](#media-block), [Rich Text](#rich-text-block), [Hero](#hero-block). Grid and columns are excluded because neither means anything as a slide; the carousel excludes itself because nested horizontal scroll containers contend for the same drag and touch pan (ADR-0020).

### Localisation

Fields typed "localized string" use Amplience's `localization` core schema: one value per locale, resolved at the content-client boundary. Delivery returns the value for the requested locale, so components receive a plain string.

## Adding a content type

The shape of the work, end to end:

1. Add the JSON schema to [`content-type-schemas/schemas`](../packages/hub-management/content-type-schemas/schemas), following the `{repository}_{name}.json` convention.
2. Add the matching registration to [`content-types`](../packages/hub-management/content-types) — label, icon URL, visualisations, repository.
3. Add an icon to [`icons/svg`](../packages/hub-management/icons/svg), generate the PNG, and publish it to Content Hub so the registration URL resolves.
4. Build the component in [`packages/components/src`](../packages/components/src) with a `*.registry.ts` entry that dispatches on the schema URI.
5. Add a `*.stories.tsx` with the `autodocs` tag.
6. If it is a block, add it to [`partials/content-blocks`](#content-block) (and [`partials/carousel-items`](#carousel-item) if it works as a slide).
7. Run `pnpm hub:import` to push the model to a hub — see [Working with a hub](working-with-a-hub.md).
8. Add it to this page.
