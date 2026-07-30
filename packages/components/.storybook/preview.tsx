import type { Preview } from '@storybook/nextjs-vite'

import '@storybook/addon-docs/blocks'
// Design tokens — the CSS variable contract per ADR-0002
import '@amplience/quadratic-theme/tokens.css'
// Global reset + brand font loading — mirrors apps/web/app/globals.css.
// Fonts are loaded via Google Fonts @import here (next/font/google is a
// Next.js build-time transform and is a no-op in the Vite/Storybook context).
import './preview-globals.css'

const customViewports = {
  smallMobile: {
    name: 'Small Mobile',
    styles: {
      width: '360px',
      height: '640px',
    },
    type: 'mobile',
  },
  largeMobile: {
    name: 'Large Mobile',
    styles: {
      width: '414px',
      height: '896px',
    },
    type: 'mobile',
  },
  tablet: {
    name: 'Tablet',
    styles: {
      width: '768px',
      height: '1024px',
    },
    type: 'tablet',
  },
  smallDesktop: {
    name: 'Small Desktop / Laptop',
    styles: {
      width: '1366px',
      height: '768px',
    },
    type: 'desktop',
  },
  desktop: {
    name: 'Standard Desktop / Laptop',
    styles: {
      width: '1920px',
      height: '1080px',
    },
    type: 'desktop',
  },
  largeDesktop: {
    name: 'Large Desktop (QHD)',
    styles: {
      width: '2560px',
      height: '1440px',
    },
    type: 'desktop',
  },
}

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'white',
      values: [
        { name: 'white', value: '#ffffff' },
        { name: 'gray', value: '#e0e0e0' },
        { name: 'dark', value: '#111111' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      // Suppress noise from low-value HTML passthrough props
      exclude: ['className', 'style'],
    },
    // Center atoms in the canvas by default. Components that need edge-to-edge
    // layout (Container, Stack, and future molecules/organisms) override with
    // layout: 'fullscreen' in their own meta.
    layout: 'centered',
    options: {
      storySort: {
        order: ['Intro', 'Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages'],
      },
    },
    viewport: {
      options: customViewports,
    },
  },

  /**
   * Brand switcher — sets [data-brand] on the story root, which activates the
   * corresponding CSS variable overrides per ADR-0002 §5. Lets us preview any
   * component in any deployed brand without changing component source.
   *
   * Add new brands here as private brand themes are created.
   */
  globalTypes: {
    brand: {
      description: 'Active brand theme ([data-brand])',
      defaultValue: 'default',
      toolbar: {
        title: 'Brand',
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Default Theme' },
          { value: 'amplience', title: 'Amplience' },
          { value: 'anyafinn', title: 'Anya Finn' },
          { value: 'arbor-harvest', title: 'Arbor & Harvest' },
          { value: 'azure-harvest', title: 'Azure Harvest' },
          { value: 'culinary-supply-hub', title: 'Culinary Supply Hub' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      // Apply the selected [data-brand] to the story wrapper so CSS variable
      // overrides from the brand stylesheet take effect (ADR-0002 §5).
      const brand = context.globals.brand as string
      return (
        <div
          data-brand={brand}
          // style={{ minHeight: context.viewMode === 'docs' ? undefined : '100vh' }}
        >
          <Story />
        </div>
      )
    },
  ],
}

export default preview
