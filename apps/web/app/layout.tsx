import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { brandFonts } from '@amplience/quadratic-theme/fonts'

import './globals.css'
import '@amplience/quadratic-theme/tokens.css'

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={fontVariables}
      data-brand={process.env.NEXT_PUBLIC_BRAND ?? 'default'}
    >
      <body>{children}</body>
    </html>
  )
}
