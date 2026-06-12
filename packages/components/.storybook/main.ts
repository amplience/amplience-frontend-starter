import type { StorybookConfig } from '@storybook/nextjs-vite'

/**
 * Storybook configuration for @amplience/quadratic-components.
 *
 * Framework: @storybook/nextjs-vite (Storybook 10)
 *   - Official framework for Next.js + Vite (recommended over experimental-nextjs-vite)
 *   - Handles next/image and next/link automatically — no manual mocks needed
 *   - Vite builder aligns with the Vitest-based test stack (ADR-0006)
 *
 * React alias (viteFinal):
 *   @storybook/nextjs-vite redirects `react` → `next/dist/compiled/react` so
 *   Next.js and React share a single instance at runtime. That directory has no
 *   valid ESM entry point for Node's resolver, which causes "Directory import not
 *   supported" errors when @storybook/addon-vitest runs tests inside Storybook.
 *   viteFinal overrides those aliases back to the real packages after the
 *   framework has set them up. The standalone `pnpm test` path is handled by the
 *   same aliases in vitest.config.ts.
 *
 * See ADR-0005 for builder and convention decisions.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-mcp',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  // `docs.autodocs` no longer exists as an option — autodocs-by-tag is the
  // built-in behaviour now, driven by the `autodocs` tag on stories.
  viteFinal(config) {
    // import.meta.dirname is the ESM equivalent of __dirname (Node 21.2+).
    // Storybook is run from packages/components, so node_modules/react resolves
    // to the correct workspace package.
    const dir = import.meta.dirname
    config.resolve ??= {}
    config.resolve.alias = {
      ...((config.resolve.alias as Record<string, string>) ?? {}),
      react: `${dir}/../node_modules/react`,
      'react-dom': `${dir}/../node_modules/react-dom`,
      'react-dom/client': `${dir}/../node_modules/react-dom/client.js`,
    }
    return config
  },
}

export default config
