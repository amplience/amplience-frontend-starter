// packages/components vitest config.
//
// Extends the shared preset with:
//   - jsdom environment so React component tests have a real DOM (ADR-0006 §A2)
//   - storybookTest() plugin from @storybook/addon-vitest
//
// NOTE: this config is not yet wired into a vitest workspace. Until a
// vitest.workspace.ts is added at the repo root, run tests in this package via
// `pnpm --filter @amplience/quadratic-components test`.
//
// REACT DEDUPLICATION:
// pnpm installs a local copy of `react` in packages/components/node_modules
// (pulled in by react-markdown's peer dep), but `react-dom` is symlinked from
// the repo-root pnpm store — so they reference different React objects.
// When @testing-library/react renders a component, react-dom registers its
// dispatcher on the ROOT React's ReactCurrentDispatcher. The component then
// calls useId() on the LOCAL React's dispatcher, which is still null → crash.
//
// Fix: resolve `react` and `react/jsx-runtime` from react-dom's perspective so
// every import in the Vite graph lands on the same instance that react-dom uses.
// createRequire(reactDomPkg) follows pnpm's symlink from react-dom's directory
// and returns the absolute path to the root-store react.

import { createRequire } from 'node:module'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { defineConfig, mergeConfig } from 'vitest/config'

import base from '@amplience/quadratic-config/vitest'

const _require = createRequire(import.meta.url)
const reactDomPkg = _require.resolve('react-dom/package.json')
const _requireFromReactDom = createRequire(reactDomPkg)
const reactEntry = _requireFromReactDom.resolve('react')
const reactJsxRuntime = _requireFromReactDom.resolve('react/jsx-runtime')

export default mergeConfig(
  base,
  defineConfig({
    plugins: [
      storybookTest({
        configDir: '.storybook',
      }),
    ],
    resolve: {
      alias: {
        // Force all Vite-processed `react` imports to the same physical file
        // that react-dom uses, eliminating the duplicate-instance problem.
        react: reactEntry,
        'react/jsx-runtime': reactJsxRuntime,
      },
    },
    test: {
      environment: 'jsdom',
    },
  }),
)
