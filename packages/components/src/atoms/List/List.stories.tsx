import type { Meta, StoryObj } from '@storybook/react'

import { ListItem } from '../ListItem/ListItem'
import { List } from './List'

const meta = {
  title: 'Atoms/List',
  component: List,
  tags: ['autodocs'],
  argTypes: {
    as: {
      control: 'radio',
      options: ['ul', 'ol'],
    },
    gap: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'],
    },
    marker: {
      control: 'radio',
      options: ['auto', 'none'],
    },
  },
} satisfies Meta<typeof List>

export default meta
type Story = StoryObj<typeof List>

export const Playground: Story = {
  args: {
    as: 'ul',
    gap: 'sm',
    marker: 'auto',
    children: (
      <>
        <ListItem>First item</ListItem>
        <ListItem>Second item</ListItem>
        <ListItem>Third item</ListItem>
      </>
    ),
  },
}

export const Unordered: Story = {
  name: 'Unordered list',
  render: () => (
    <List gap="xs">
      <ListItem>Apples</ListItem>
      <ListItem>Bananas</ListItem>
      <ListItem>Oranges</ListItem>
    </List>
  ),
}

export const Ordered: Story = {
  name: 'Ordered list',
  render: () => (
    <List as="ol" gap="xs">
      <ListItem>First step</ListItem>
      <ListItem>Second step</ListItem>
      <ListItem>Third step</ListItem>
    </List>
  ),
}

export const NoMarker: Story = {
  name: 'No markers — card layout',
  render: () => (
    <List marker="none" gap="md" style={{ maxWidth: 320 }}>
      {['Alpha', 'Beta', 'Gamma'].map((name) => (
        <ListItem
          key={name}
          style={{
            padding: '1rem',
            border: '1px solid var(--color-gray-300)',
            borderRadius: 'var(--radius)',
          }}
        >
          {name}
        </ListItem>
      ))}
    </List>
  ),
}

export const GapScale: Story = {
  name: 'Gap scale',
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
          <List gap={gap} marker="none">
            <ListItem style={{ background: 'var(--color-gray-100)', padding: '4px 8px' }}>
              Item A
            </ListItem>
            <ListItem style={{ background: 'var(--color-gray-100)', padding: '4px 8px' }}>
              Item B
            </ListItem>
            <ListItem style={{ background: 'var(--color-gray-100)', padding: '4px 8px' }}>
              Item C
            </ListItem>
          </List>
        </div>
      ))}
    </div>
  ),
}
