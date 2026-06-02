import type { Preview } from '@storybook/nextjs-vite'

// Design tokens — the CSS variable contract per ADR-0002
import '@amplience/quadratic-theme/tokens.css'
// Global reset — mirrors apps/web/app/globals.css
import './preview-globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      // Suppress noise from low-value HTML passthrough props
      exclude: ['className', 'style'],
    },
    docs: {
      story: {
        height: 'auto', // Overrides min-height to allow automatic resizing
        inline: true, // Renders the story in-place
      },
    },
    // Disable the default padding Storybook adds around stories — components
    // that control their own spacing (Container, Stack) need a clean canvas.
    layout: 'fullscreen',
    backgrounds: {
      default: 'white',
      values: [
        { name: 'white', value: '#ffffff' },
        { name: 'gray', value: '#e0e0e0' },
        { name: 'dark', value: '#111111' },
      ],
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
          style={{ minHeight: context.viewMode === 'docs' ? undefined : '100vh' }}
        >
          <Story />
        </div>
      )
    },
  ],
}

export default preview
