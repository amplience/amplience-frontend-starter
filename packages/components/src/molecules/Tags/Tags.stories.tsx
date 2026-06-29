import type { Meta, StoryObj } from '@storybook/react'

import { Tags } from './Tags'

const meta = {
  title: 'Molecules/Tags',
  component: Tags,
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'tertiary'],
    },
    tags: { control: 'object' },
  },
  parameters: {
    controls: { disable: true },
    layout: 'padded',
  },
} satisfies Meta<typeof Tags>

export default meta
type Story = StoryObj<typeof Tags>

const sampleTags = ['amplience', 'cms', 'getting-started', 'headless', 'next-js'] as const

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    tags: [...sampleTags],
    color: 'default',
  },
}

export const Colors: Story = {
  name: 'Colour variants',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {(['default', 'primary', 'secondary', 'tertiary'] as const).map((color) => (
        <div key={color} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'var(--color-gray-600)',
            }}
          >
            color=&quot;{color}&quot;
          </p>
          <Tags tags={[...sampleTags]} color={color} />
        </div>
      ))}
    </div>
  ),
}

export const Wrapping: Story = {
  name: 'Flex-wrap — many tags',
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Tags
        tags={[
          'amplience',
          'cms',
          'headless',
          'next-js',
          'content-modelling',
          'delivery-api',
          'schemas',
          'react',
          'typescript',
        ]}
      />
    </div>
  ),
}

export const Empty: Story = {
  name: 'Empty — renders nothing',
  render: () => (
    <div>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
        (empty tags array — no element rendered)
      </p>
      <Tags tags={[]} />
    </div>
  ),
}
