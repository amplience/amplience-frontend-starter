import type { Meta, StoryObj } from '@storybook/react'

import { MarkdownBlock } from './MarkdownBlock'

const meta = {
  title: 'Organisms/MarkdownBlock',
  component: MarkdownBlock,
  tags: ['autodocs'],
  argTypes: {
    maxWidth: {
      control: 'radio',
      options: ['narrow', 'default', 'wide', 'none'],
    },
    backgroundColor: {
      control: 'select',
      options: ['light', 'white', 'dark', 'black', 'primary', 'secondary', 'tertiary'],
    },
    gutter: { control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MarkdownBlock>

export default meta
type Story = StoryObj<typeof MarkdownBlock>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const INTRO = `## What's in the box

A **recursive renderer**, a content-client abstraction with mock and SDK adapters, an atomic-design component library, and an automation CLI for hub provisioning.

Clone, point at an Amplience hub, ship.`

const RICH = `## Features

### Content client

\`\`\`typescript
const client = makeMockContentClient()
const slot = await client.getByKey('home/main', { depth: 'all' })
\`\`\`

### Slot renderer

- Dispatches on \`_meta.schema\`
- Unknown types render a \`<Placeholder>\`
- Nested blocks (GridBlock, ColumnsBlock) resolve children recursively

> Brands override design tokens under \`[data-brand]\` without touching component files.

For more detail, see the [documentation](/docs).`

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'Default',
  args: { content: INTRO, gutter: true },
}

export const NarrowGutter: Story = {
  name: 'Narrow with gutter',
  args: { content: INTRO, maxWidth: 'narrow', gutter: true },
}

export const RichContent: Story = {
  name: 'Rich — headings, code, lists, blockquote',
  args: { content: RICH, maxWidth: 'narrow', gutter: true },
}

export const LightBackground: Story = {
  name: 'Background — light',
  args: { content: INTRO, backgroundColor: 'light', gutter: true },
}

export const DarkBackground: Story = {
  name: 'Background — dark',
  args: { content: INTRO, backgroundColor: 'dark', gutter: true },
}

export const PrimaryBackground: Story = {
  name: 'Background — primary',
  args: { content: INTRO, backgroundColor: 'primary', gutter: true },
}

export const WithCtas: Story = {
  name: 'With CTAs',
  args: {
    content: INTRO,
    maxWidth: 'narrow',
    gutter: true,
    ctas: [
      { label: 'Read the docs', href: '/docs', variant: 'solid', color: 'primary' },
      {
        label: 'View on GitHub',
        href: 'https://github.com/amplience/quadratic-lite',
        variant: 'outlined',
        color: 'primary',
      },
    ],
  },
}

export const CtasOnDark: Story = {
  name: 'With CTAs — dark background',
  args: {
    content: INTRO,
    backgroundColor: 'dark',
    gutter: true,
    ctas: [
      { label: 'Get started', href: '/docs/quickstart', variant: 'solid', color: 'primary' },
      { label: 'Learn more', href: '/features', variant: 'text', color: 'white' },
    ],
  },
}

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: { content: RICH, maxWidth: 'narrow', gutter: true },
}
