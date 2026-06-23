// Brand font definitions for @amplience/quadratic-theme.
//
// Each font is exposed as a CSS variable (--nf-*) so tokens.css can reference
// it under [data-brand] selectors without coupling to next/font internals.
// The consuming app applies .variable classNames to <html> so every selector
// in the document has access to all --nf-* properties.
//
// next/font/google is a Next.js build-time concern; the font *choices* live
// here so all apps in the monorepo pull from the same source of truth.

import {
  Cormorant_Garamond,
  Inter,
  Jost,
  Lato,
  Playfair_Display,
  Roboto,
  Roboto_Slab,
} from 'next/font/google'

// anyafinn — high-fashion editorial feel
export const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--nf-cormorant-garamond',
  display: 'swap',
})

export const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--nf-jost',
  display: 'swap',
})

// arbor-harvest — organic, editorial serif
export const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--nf-playfair-display',
  display: 'swap',
})

export const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--nf-lato',
  display: 'swap',
})

// azure-harvest — clean tech/SaaS
export const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--nf-inter',
  display: 'swap',
})

// culinary-supply-hub — solid B2B utilitarian
export const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--nf-roboto-slab',
  display: 'swap',
})

export const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--nf-roboto',
  display: 'swap',
})

// Convenience array — spread into <html className> in the app layout.
export const brandFonts = [
  cormorantGaramond,
  jost,
  playfairDisplay,
  lato,
  inter,
  robotoSlab,
  roboto,
]
