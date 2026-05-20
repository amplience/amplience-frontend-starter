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

import { defineConfig } from 'vitest/config'

/** @type {ReturnType<typeof defineConfig>} */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    passWithNoTests: true,
  },
})
