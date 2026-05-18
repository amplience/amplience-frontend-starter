// Shared Vitest base per ADR-0006 (Vitest + Testing Library, Option A).
//
// Each workspace's own vitest.config.ts can either re-export this as-is or
// merge package-specific overrides (e.g. `environment: 'jsdom'` for
// packages/components when React component tests land).

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    passWithNoTests: true,
  },
})
