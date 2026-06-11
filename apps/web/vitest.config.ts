// apps/web Vitest config.
//
// Extends the shared preset with `oxc.jsx.runtime: 'automatic'` — this
// package's tsconfig sets `jsx: 'preserve'` for Next.js, which Vite 8's OXC
// transform would otherwise honour, leaving JSX unparseable in test files.
// Tests here run in the node environment: the renderer is a Server Component
// surface, asserted via react-dom/server markup, so no DOM is needed.

import { defineConfig, mergeConfig } from 'vitest/config'

import base from '@amplience/quadratic-config/vitest'

export default mergeConfig(base, defineConfig({ oxc: { jsx: { runtime: 'automatic' } } }))
