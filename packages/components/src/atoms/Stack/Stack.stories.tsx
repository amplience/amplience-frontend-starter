import type { Meta, StoryObj } from '@storybook/react'

import { Placeholder } from '../Placeholder/Placeholder'
import { Stack } from './Stack'

const meta: Meta<typeof Stack> = {
  title: 'Atoms/Stack',
  component: Stack,
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: 'radio',
      options: ['column', 'row'],
    },
    gap: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
    },
    wrap: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Stack>

export const Playground: Story = {
  args: {
    direction: 'column',
    gap: 'md',
    children: (
      <>
        <Placeholder text="Item 1" />
        <Placeholder text="Item 2" />
        <Placeholder text="Item 3" />
      </>
    ),
  },
}

export const ColumnGapScale: Story = {
  name: 'Column — gap scale',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem' }}>
      {(['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const).map((gap) => (
        <div key={gap}>
          <p
            style={{
              margin: '0 0 0.25rem',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'var(--color-gray-600)',
            }}
          >
            gap=&quot;{gap}&quot;
          </p>
          <Stack gap={gap}>
            <Placeholder />
            <Placeholder />
            <Placeholder />
          </Stack>
        </div>
      ))}
    </div>
  ),
}

export const Row: Story = {
  name: 'Row — gap md',
  render: () => (
    <div style={{ padding: '1rem' }}>
      <Stack direction="row" gap="md">
        <Placeholder text="A" />
        <Placeholder text="B" />
        <Placeholder text="C" />
      </Stack>
    </div>
  ),
}

export const RowWrapping: Story = {
  name: 'Row — wrapping',
  render: () => (
    <div style={{ padding: '1rem', maxWidth: 360 }}>
      <Stack direction="row" gap="sm" wrap>
        {Array.from({ length: 8 }, (_, i) => (
          <Placeholder key={i} text={`${i + 1}`} height={40} />
        ))}
      </Stack>
    </div>
  ),
}
