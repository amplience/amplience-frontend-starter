// Shared Vitest base per ADR-0006 (Vitest + Testing Library, Option A).
//
// Each workspace's own vitest.config.{js,ts} can either re-export this as-is
// or merge package-specific overrides (e.g. `environment: 'jsdom'` for
// packages/components when React component tests land).
//
// Authored as .js (not .ts) so consumers can `import` it via Node's regular
// resolver across all supported Node versions. Vitest transpiles its own
// config file with esbuild, but a cross-package `.ts` import would force
// Node 22.6+ on every contributor and CI runner.

import { coverageConfigDefaults, defineConfig } from 'vitest/config'

/** @type {ReturnType<typeof defineConfig>} */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      // On top of Vitest's defaults (tests, node_modules, config files):
      // stories and Storybook scaffolding are documentation, and CSS modules
      // aren't executable surface — none of them are code the suite should
      // be asked to exercise.
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/*.stories.{ts,tsx}',
        '**/.storybook/**',
        '**/storybook-static/**',
        '**/*.module.css',
      ],
      // QL-40: ≥90% on all four metrics. The floor is a property of CI, not
      // of reviewer vigilance — a change that drops below it fails the run.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
})
