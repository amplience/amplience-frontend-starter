import type { Meta, StoryObj } from '@storybook/react'

import { Tag } from './Tag'

const meta = {
  title: 'Atoms/Tag',
  component: Tag,
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'tertiary'],
    },
    children: { control: 'text' },
  },
  parameters: {
    controls: { disable: true },
    layout: 'padded',
  },
} satisfies Meta<typeof Tag>

export default meta
type Story = StoryObj<typeof Tag>

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    children: 'getting-started',
    color: 'default',
  },
}

export const Colors: Story = {
  name: 'Colour variants',
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {(['default', 'primary', 'secondary', 'tertiary'] as const).map((color) => (
        <Tag key={color} color={color}>
          {color}
        </Tag>
      ))}
    </div>
  ),
}

export const InContext: Story = {
  name: 'In context — alongside body text',
  render: () => (
    <p style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span>Article tags:</span>
      <Tag>amplience</Tag>
      <Tag>cms</Tag>
      <Tag color="primary">featured</Tag>
    </p>
  ),
}
