// Root Vitest config — the shared preset plus root-level overrides.
//
// `oxc.jsx.runtime: 'automatic'` is needed because apps/web's tsconfig sets
// `jsx: 'preserve'` (Next.js compiles JSX itself), and Vite 8's OXC
// transform respects the nearest tsconfig — leaving JSX untransformed and
// unparseable for test files under apps/web. Every package in the workspace
// uses the automatic JSX runtime, so the override is uniform and safe.
// Individual packages can still merge their own overrides (e.g. jsdom env
// in packages/components).
//
// `resolve.alias` for 'next/font/google' — font constructors are Next.js
// build-time only and throw in plain Node. The alias redirects all imports
// to a static mock before any module executes. It lives here (not in
// apps/web/vitest.config.ts) because this root config is what actually runs
// the full test suite; the per-package configs are not used by the runner.

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
        'next/font/google': resolve(__dirname, 'apps/web/__mocks__/next-font-google.ts'),
      },
    },
    oxc: { jsx: { runtime: 'automatic' } },
  }),
)
