import type { Meta, StoryObj } from '@storybook/react'

import { Divider } from './Divider'

const meta = {
  title: 'Atoms/Divider',
  component: Divider,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    orientation: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Divider>

export default meta
type Story = StoryObj<typeof Divider>

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
}

export const Vertical: Story = {
  render: () => (
    <div style={{ display: 'flex', height: 48, alignItems: 'center', gap: '1rem' }}>
      <span>Left</span>
      <Divider orientation="vertical" />
      <span>Right</span>
    </div>
  ),
}

export const BetweenContent: Story = {
  name: 'Between content blocks',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ margin: 0 }}>First block of content.</p>
      <Divider />
      <p style={{ margin: 0 }}>Second block of content.</p>
      <Divider />
      <p style={{ margin: 0 }}>Third block of content.</p>
    </div>
  ),
}
