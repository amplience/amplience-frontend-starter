import type { Meta, StoryObj } from '@storybook/react'

import { SectionHeader } from './SectionHeader'

const meta = {
  title: 'Molecules/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    description: { control: 'text' },
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof SectionHeader>

export const Playground: Story = {
  args: {
    title: 'Featured products',
    subtitle: 'Hand-picked for the season',
    description: 'A short introduction to the section, giving context to the content below.',
  },
}

export const TitleOnly: Story = {
  name: 'Title only',
  args: {
    title: 'Featured products',
  },
}

export const TitleAndSubtitle: Story = {
  name: 'Title + subtitle',
  args: {
    title: 'Featured products',
    subtitle: 'Hand-picked for the season',
  },
}

export const TitleAndDescription: Story = {
  name: 'Title + description',
  args: {
    title: 'Featured products',
    description: 'A short introduction to the section, giving context to the content below.',
  },
}

export const NoContent: Story = {
  name: 'No content — renders nothing',
  args: {
    title: undefined,
  },
}
