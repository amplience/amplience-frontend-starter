/**
 * Web app manifest, generated from site config (lib/site.ts) so the app
 * name, theme colour, and icon locations stay consistent with the rest of
 * the deployment's configuration. Next links it from <head> automatically.
 */

import type { MetadataRoute } from 'next'

import { faviconBase, siteDescription, siteTitle, themeColor } from '../lib/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteTitle,
    short_name: siteTitle,
    description: siteDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: themeColor,
    icons: [
      { src: `${faviconBase}/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${faviconBase}/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  }
}
