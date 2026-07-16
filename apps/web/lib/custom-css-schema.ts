/**
 * Shared, dependency-free constants/helpers for the CMS custom-CSS type.
 *
 * Kept separate from `custom-css.ts` (which imports the server-only content
 * client and next/cache) so both server and client modules — the fetch helper,
 * the visualization page, and the visualization client component — can import
 * these without pulling server code into the client bundle.
 */

/** The custom-CSS content type's schema URI (its `_meta.schema`). */
export const CUSTOM_CSS_SCHEMA = 'https://quadratic.amplience.com/v2/sitestructure/custom-css'

/**
 * Identifier shared by the injected custom-CSS `<style>` — its element id, and
 * the React `href`/`precedence` key of the site-wide injection (app/layout.tsx).
 * The visualizer selects the published block by its `data-precedence` to disable
 * it, so keep the injection and that selector reading from this one constant.
 */
export const CUSTOM_CSS_STYLE_ID = 'amplience-custom-css'

/**
 * Neutralise a `</style>` breakout in author-supplied CSS. Inside a <style> raw
 * text element the parser ends the element at `</style`, so a stray closing tag
 * could inject arbitrary markup. Escaping the slash keeps it inert; within a CSS
 * string `\/` still resolves to `/`, so legitimate content is unaffected. CSS
 * cannot execute script, and the field is gated behind a permissioned repo, so
 * this is the only escaping the injection needs.
 */
export function sanitizeCustomCss(css: string): string {
  return css.replace(/<\/(style)/gi, '<\\/$1')
}
