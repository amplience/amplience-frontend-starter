// packages/components overrides the shared preset with a jsdom environment
// so React component tests have a real DOM available (per ADR-0006 §A2).
//
// NOTE: this config is not yet wired into a vitest workspace. Until a
// vitest.workspace.ts is added at the repo root, individual test files use
// the `// @vitest-environment jsdom` docblock to request jsdom per-file.
// The workspace setup will land alongside the Storybook ticket.

import { defineConfig, mergeConfig } from 'vitest/config'

import base from '@amplience/quadratic-config/vitest'

export default mergeConfig(base, defineConfig({ test: { environment: 'jsdom' } }))
