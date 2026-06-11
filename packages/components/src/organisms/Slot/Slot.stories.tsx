import type { Meta, StoryObj } from '@storybook/react'

import { Placeholder } from '../../atoms/Placeholder/Placeholder'
import { Slot } from './Slot'

const meta = {
  title: 'Organisms/Slot',
  component: Slot,
  tags: ['autodocs'],
  parameters: { controls: { disable: true }, layout: 'padded' },
} satisfies Meta<typeof Slot>

export default meta
type Story = StoryObj<typeof Slot>

export const Default: Story = {
  name: 'Components in content order',
  render: () => (
    <Slot name="home/main">
      <Placeholder text="hero" height={120} />
      <Placeholder text="image" height={80} />
      <Placeholder text="grid" height={160} />
    </Slot>
  ),
}
