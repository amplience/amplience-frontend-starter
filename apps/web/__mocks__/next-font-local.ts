// Vitest mock for next/font/local.
// next/font constructors are Next.js build-time only — they throw in plain
// Node. This file is aliased in vitest.config.ts so every import of
// 'next/font/local' in the test suite resolves here instead.
//
// next/font/local has a single default export, so (unlike the old
// next/font/google mock) adding a font to packages/theme/src/fonts.ts needs
// no change here.

const localFont = (): { className: string; variable: string; style: string } => ({
  className: '',
  variable: '--nf-mock',
  style: '',
})

export default localFont
