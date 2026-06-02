import type { Meta, StoryObj } from '@storybook/react'

import { List } from '../List/List'
import { ListItem } from './ListItem'

const meta = {
  title: 'Atoms/ListItem',
  component: ListItem,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <List marker="none" gap="sm">
        <Story />
      </List>
    ),
  ],
} satisfies Meta<typeof ListItem>

export default meta
type Story = StoryObj<typeof ListItem>

export const Playground: Story = {
  args: {
    children: 'A single list item',
  },
}

export const InContext: Story = {
  name: 'Multiple items in a List',
  render: () => (
    <List gap="xs">
      <ListItem>First item</ListItem>
      <ListItem>Second item</ListItem>
      <ListItem>Third item</ListItem>
    </List>
  ),
}
