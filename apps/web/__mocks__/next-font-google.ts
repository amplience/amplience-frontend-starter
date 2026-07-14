// Vitest mock for next/font/google.
// next/font constructors are Next.js build-time only — they throw in plain
// Node. This file is aliased in vitest.config.ts so every import of
// 'next/font/google' in the test suite resolves here instead.
//
// ESM named imports are resolved statically, so each font used in
// packages/theme/src/fonts.ts must be re-exported by name here — an unlisted
// font resolves to `undefined` and calling it throws "is not a function".
// Keep this list in sync with the imports in fonts.ts.

const font = (): { className: string; variable: string; style: string } => ({
  className: '',
  variable: '--nf-mock',
  style: '',
})

export const Cormorant_Garamond = font
export const IBM_Plex_Sans = font
export const Jost = font
export const Playfair_Display = font
export const Lato = font
export const Inter = font
export const Roboto_Slab = font
export const Roboto = font
