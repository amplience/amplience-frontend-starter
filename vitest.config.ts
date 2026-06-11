// Root Vitest config — the shared preset plus one root-level override.
//
// `oxc.jsx.runtime: 'automatic'` is needed because apps/web's tsconfig sets
// `jsx: 'preserve'` (Next.js compiles JSX itself), and Vite 8's OXC
// transform respects the nearest tsconfig — leaving JSX untransformed and
// unparseable for test files under apps/web. Every package in the workspace
// uses the automatic JSX runtime, so the override is uniform and safe.
// Individual packages can still merge their own overrides (e.g. jsdom env
// in packages/components).

import { defineConfig, mergeConfig } from 'vitest/config'

import base from '@amplience/quadratic-config/vitest'

export default mergeConfig(base, defineConfig({ oxc: { jsx: { runtime: 'automatic' } } }))
