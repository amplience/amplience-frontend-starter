/**
 * Site-level deployment configuration, read from env at build time.
 *
 * One surface for everything the document shell needs — metadata defaults
 * (layout.tsx) and the web manifest (app/manifest.ts) both read from here,
 * so a deployment configures each value exactly once. The literals are the
 * accelerator's own Quadratic defaults; see .env.example for the knobs.
 */

export const siteTitle = process.env.SITE_TITLE ?? 'Quadratic Lite'

export const siteDescription =
  process.env.SITE_DESCRIPTION ?? 'An open-source accelerator for Amplience'

/**
 * Public origin — metadataBase for resolving relative canonical/og URLs.
 *
 * Resolution chain: explicit SITE_URL (the custom-domain override) →
 * VERCEL_PROJECT_PRODUCTION_URL (a bare hostname Vercel injects into every
 * deployment, so canonicals are correct by default there) → localhost for
 * local dev. Without this chain an unset SITE_URL on Vercel would quietly
 * ship `<link rel="canonical" href="http://localhost:3000/…">` to search
 * engines — visually fine, semantically wrong.
 */
const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL

export const siteUrl =
  process.env.SITE_URL ??
  (vercelProductionUrl !== undefined && vercelProductionUrl !== ''
    ? `https://${vercelProductionUrl}`
    : 'http://localhost:3000')

/**
 * Where the favicon set lives. The filenames are fixed convention
 * (favicon.ico, icon.svg, apple-touch-icon.png, icon-192.png, icon-512.png);
 * only the base is configurable. Default is the bundled Quadratic set in
 * `public/favicon/`; a deployment either replaces those files or points
 * this at its own host (a CDN, or Amplience Dynamic Media).
 */
export const faviconBase = process.env.FAVICON_BASE_URL ?? '/favicon'

/** Browser-chrome theme colour (manifest + meta). Quadratic brand purple. */
export const themeColor = process.env.THEME_COLOR ?? '#7340e7'
