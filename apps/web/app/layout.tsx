import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { brandFonts } from '@amplience/quadratic-theme/fonts'

import './globals.css'
import '@amplience/quadratic-theme/tokens.css'

import { getCustomCss } from '../lib/custom-css'
import { faviconBase, siteDescription, siteTitle, siteUrl, themeColor } from '../lib/site'

const fontVariables = brandFonts.map((f) => f.variable).join(' ')

export const metadata: Metadata = {
  /**
   * Base URL for resolving relative metadata URLs (canonical, og:image …).
   * Set SITE_URL per deployment; the localhost fallback keeps local builds
   * working and is obviously-wrong enough to spot in page source.
   */
  metadataBase: new URL(siteUrl),
  title: {
    template: `%s | ${siteTitle}`,
    default: siteTitle,
  },
  description: siteDescription,
  /**
   * Favicons are config-based (not app/ file-convention) on purpose:
   * file-based metadata overrides config, which would make the set
   * impossible to override per deployment via FAVICON_BASE_URL. The
   * filenames are fixed; only the base location is configurable. A copy of
   * favicon.ico also sits at public/ root for browsers that request
   * /favicon.ico blindly.
   */
  icons: {
    icon: [
      { url: `${faviconBase}/favicon.ico`, sizes: '32x32' },
      { url: `${faviconBase}/icon.svg`, type: 'image/svg+xml' },
    ],
    apple: `${faviconBase}/apple-touch-icon.png`,
  },
}

export const viewport: Viewport = {
  themeColor,
}

/**
 * Root layout — the minimal html/body shell shared by every route.
 *
 * Header and footer live in `(site)/[locale]/layout.tsx` so they apply only to
 * the main site routes, not to the visualization tool or any other isolated
 * route that needs to control its own chrome.
 *
 * Optional CMS-managed custom CSS is injected here, at the root, so it applies
 * everywhere the tokens do — the site *and* the visualization tool — mirroring
 * the `tokens.css` import above. The feature is off unless
 * AMPLIENCE_CUSTOM_CSS="TRUE"; when off `getCustomCss` returns null and does no
 * CMS I/O, keeping default deployments pure-static.
 *
 * The <style> carries `href` + `precedence`: React 19 only reliably emits a
 * `dangerouslySetInnerHTML` style rendered in <body> during streaming SSR when
 * it is a managed style resource (a plain one is dropped), so it is hoisted
 * into <head> and deduped by href. Because the token stylesheets are imported
 * at the top of this module, React encounters their precedence group first and
 * orders this style *after* them — so it still overrides the token defaults at
 * equal specificity without !important.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const customCss = await getCustomCss()
  console.log('[custom-css] injecting', customCss === null ? 'no CSS' : 'custom CSS', customCss)
  return (
    <html
      lang="en"
      className={fontVariables}
      data-brand={process.env.NEXT_PUBLIC_BRAND ?? 'default'}
    >
      <body>
        {children}
        {/* Gated, permissioned, </style>-escaped CSS (see getCustomCss). */}
        {customCss !== null && (
          <style
            href="amplience-custom-css"
            precedence="amplience-custom-css"
            dangerouslySetInnerHTML={{ __html: customCss }}
          />
        )}
      </body>
    </html>
  )
}
