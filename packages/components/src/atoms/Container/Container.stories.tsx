import type { Meta, StoryObj } from '@storybook/react'

import { Container } from './Container'

const meta = {
  title: 'Atoms/Container',
  component: Container,
  tags: ['autodocs'],
  argTypes: {
    maxWidth: {
      control: 'select',
      options: ['narrow', 'default', 'wide', 'full'],
    },
    gutter: { control: 'boolean' },
  },
} satisfies Meta<typeof Container>

export default meta
type Story = StoryObj<typeof Container>

// Helper that makes the container bounds visible
function Box({ label }: { label: string }) {
  return (
    <div
      style={{
        background: 'var(--color-gray-200)',
        border: '1px dashed var(--color-gray-400)',
        padding: '1rem',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        color: 'var(--color-gray-700)',
        textAlign: 'center',
      }}
    >
      {label}
    </div>
  )
}

export const Playground: Story = {
  args: {
    maxWidth: 'default',
    gutter: true,
    children: <Box label='maxWidth="default" gutter' />,
  },
}

export const MaxWidthScale: Story = {
  name: 'Max-width scale',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem 0' }}>
      {(['narrow', 'default', 'wide', 'full'] as const).map((maxWidth) => (
        <Container key={maxWidth} maxWidth={maxWidth} gutter>
          <Box label={`maxWidth="${maxWidth}" with gutter`} />
        </Container>
      ))}
    </div>
  ),
}

export const GutterToggle: Story = {
  name: 'Gutter on / off',
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem 0',
        background: 'var(--color-gray-100)',
      }}
    >
      <Container maxWidth="default" gutter>
        <Box label="gutter (default padding)" />
      </Container>
      <Container maxWidth="default">
        <Box label="no gutter (edge-to-edge within max-width)" />
      </Container>
    </div>
  ),
}
