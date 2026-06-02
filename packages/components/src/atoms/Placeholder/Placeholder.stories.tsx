import type { Meta, StoryObj } from '@storybook/react'

import { Placeholder } from './Placeholder'

const meta: Meta<typeof Placeholder> = {
  title: 'Atoms/Placeholder',
  component: Placeholder,
  tags: ['autodocs'],
  parameters: { controls: { disable: true }, layout: 'padded' },
  argTypes: {
    height: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof Placeholder>

export const Blank: Story = {
  args: {},
}

export const WithLabel: Story = {
  args: {
    text: 'maxWidth="narrow" with gutter',
  },
}

export const CustomHeight: Story = {
  args: {
    height: 120,
    text: 'height={120}',
  },
}

export const InLayout: Story = {
  name: 'Multiple in a layout',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <Placeholder text="Slot A" />
      <Placeholder text="Slot B" />
      <Placeholder text="Slot C" height={80} />
    </div>
  ),
}
