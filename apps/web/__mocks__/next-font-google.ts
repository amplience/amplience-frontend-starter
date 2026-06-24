// Vitest mock for next/font/google.
// next/font constructors are Next.js build-time only — they throw in plain
// Node. This file is aliased in vitest.config.ts so every import of
// 'next/font/google' in the test suite resolves here instead.
// Adding a new font to packages/theme/src/fonts.ts does not require
// updating this file — unknown named imports just resolve to `font`.

const font = (): { className: string; variable: string; style: string } => ({
  className: '',
  variable: '--nf-mock',
  style: '',
})

export const Cormorant_Garamond = font
export const Jost = font
export const Playfair_Display = font
export const Lato = font
export const Inter = font
export const Roboto_Slab = font
export const Roboto = font
