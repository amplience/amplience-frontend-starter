import type { Meta, StoryObj } from '@storybook/react'

import { Typography } from './Typography'

const meta = {
  title: 'Atoms/Typography',
  component: Typography,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'caption'],
    },
    align: {
      control: 'select',
      options: [undefined, 'left', 'center', 'right'],
    },
  },
} satisfies Meta<typeof Typography>

export default meta
type Story = StoryObj<typeof Typography>

export const Playground: Story = {
  args: {
    variant: 'p',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
}

export const TypeScale: Story = {
  render: () => (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Typography variant="h1">Heading 1</Typography>
      <Typography variant="h2">Heading 2</Typography>
      <Typography variant="h3">Heading 3</Typography>
      <Typography variant="h4">Heading 4</Typography>
      <Typography variant="h5">Heading 5</Typography>
      <Typography variant="h6">Heading 6</Typography>
      <Typography variant="p">
        Body — the quick brown fox <em>jumps</em> over the <strong>lazy</strong> dog.
      </Typography>
      <Typography variant="caption" as="p">
        Caption — supplementary text at small size.
      </Typography>
    </div>
  ),
}

export const Alignment: Story = {
  render: () => (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Typography variant="p" align="left">
        Left-aligned (default)
      </Typography>
      <Typography variant="p" align="center">
        Center-aligned
      </Typography>
      <Typography variant="p" align="right">
        Right-aligned
      </Typography>
    </div>
  ),
}

export const PolymorphicAs: Story = {
  name: 'Polymorphic (as)',
  render: () => (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Typography as="p" variant="h2">
        h2 visual style on a &lt;p&gt; element
      </Typography>
      <Typography as="span" variant="caption">
        caption style on a &lt;span&gt;
      </Typography>
    </div>
  ),
}
