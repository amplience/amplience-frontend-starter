// apps/web Vitest config.
//
// Extends the shared preset with two overrides:
//
// 1. `oxc.jsx.runtime: 'automatic'` — this package's tsconfig sets
//    `jsx: 'preserve'` for Next.js, which Vite 8's OXC transform would
//    otherwise honour, leaving JSX unparseable in test files.
//
// 2. `resolve.alias` for 'next/font/google' — font constructors are
//    Next.js build-time only and throw in plain Node. The alias is also
//    present in the root vitest.config.ts so `pnpm test` from the repo
//    root works too; both need it so either invocation is safe.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import base from '@amplience/frontend-starter-config/vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: {
        'next/font/google': resolve(__dirname, '__mocks__/next-font-google.ts'),
      },
    },
    oxc: { jsx: { runtime: 'automatic' } },
  }),
)
