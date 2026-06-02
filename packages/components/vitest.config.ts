// packages/components vitest config.
//
// Extends the shared preset with:
//   - jsdom environment so React component tests have a real DOM (ADR-0006 §A2)
//   - storybookTest() plugin from @storybook/addon-vitest
//
// NOTE: this config is not yet wired into a vitest workspace. Until a
// vitest.workspace.ts is added at the repo root, run tests in this package via
// `pnpm --filter @amplience/quadratic-components test`.

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { defineConfig, mergeConfig } from 'vitest/config'

import base from '@amplience/quadratic-config/vitest'

export default mergeConfig(
  base,
  defineConfig({
    plugins: [
      storybookTest({
        configDir: '.storybook',
      }),
    ],
    test: {
      environment: 'jsdom',
    },
  }),
)
