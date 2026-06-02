import type { Meta, StoryObj } from '@storybook/react'

import { Card } from './Card'

const meta = {
  title: 'Atoms/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    elevation: {
      control: 'radio',
      options: ['flat', 'raised', 'bordered'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
    color: {
      control: 'select',
      options: ['white', 'light', 'dark', 'black', 'primary', 'secondary', 'tertiary'],
    },
    interactive: { control: 'boolean' },
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof Card>

const SampleContent = () => (
  <div>
    <p style={{ margin: 0, fontWeight: 600 }}>Card title</p>
    <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', opacity: 0.75 }}>
      Supporting text that describes the card content.
    </p>
  </div>
)

export const Playground: Story = {
  args: {
    elevation: 'raised',
    padding: 'md',
    color: 'white',
    interactive: false,
    style: { maxWidth: 320 },
    children: <SampleContent />,
  },
}

export const Elevations: Story = {
  name: 'Elevation variants',
  render: () => (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '2rem' }}>
      {(['flat', 'raised', 'bordered'] as const).map((elevation) => (
        <div key={elevation} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'var(--color-gray-600)',
            }}
          >
            elevation=&quot;{elevation}&quot;
          </p>
          <Card elevation={elevation} style={{ width: 240 }}>
            <SampleContent />
          </Card>
        </div>
      ))}
    </div>
  ),
}

export const Colors: Story = {
  name: 'Colour variants',
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '2rem' }}>
      {(['white', 'light', 'dark', 'black', 'primary', 'secondary', 'tertiary'] as const).map(
        (color) => (
          <div key={color} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
            <Card color={color} elevation="raised" style={{ width: 200 }}>
              <SampleContent />
            </Card>
          </div>
        ),
      )}
    </div>
  ),
}

export const Interactive: Story = {
  name: 'Interactive — hover to see lift',
  render: () => (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '2rem' }}>
      {(['raised', 'bordered', 'flat'] as const).map((elevation) => (
        <div key={elevation} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'var(--color-gray-600)',
            }}
          >
            elevation=&quot;{elevation}&quot; interactive
          </p>
          <Card elevation={elevation} interactive style={{ width: 240 }}>
            <SampleContent />
          </Card>
        </div>
      ))}
    </div>
  ),
}

export const Paddings: Story = {
  name: 'Padding variants',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
      {(['none', 'sm', 'md', 'lg'] as const).map((padding) => (
        <div key={padding} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'var(--color-gray-600)',
            }}
          >
            padding=&quot;{padding}&quot;
          </p>
          <Card elevation="bordered" padding={padding} style={{ maxWidth: 320 }}>
            <SampleContent />
          </Card>
        </div>
      ))}
    </div>
  ),
}
