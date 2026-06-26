import { defineConfig } from 'wxt'

export default defineConfig({
  extensionApi: 'chrome',
  manifest: {
    name: 'Quadratic Helper',
    description:
      'Demo tooling for Quadratic sites — cache busting, segment switching, theme preview.',
    version: '0.1.0',
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    action: {
      default_title: 'Quadratic Helper',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
    permissions: ['activeTab', 'scripting', 'storage'],
    // Static grants cover local dev. Custom demo domains are handled via
    // optional_host_permissions — Chrome prompts once per origin.
    host_permissions: ['http://localhost:*/*', 'https://*.vercel.app/*'],
    optional_host_permissions: ['https://*/*'],
  },
})
