import type { Meta, StoryObj } from '@storybook/react'

import { Markdown } from './Markdown'

const meta = {
  title: 'Molecules/Markdown',
  component: Markdown,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Markdown>

export default meta
type Story = StoryObj<typeof Markdown>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_SAMPLE = `## What's in the box

A **recursive renderer**, a content-client abstraction with mock and SDK adapters, an atomic-design component library, and an automation CLI for hub provisioning. Clone, point at an Amplience hub, ship.

### Getting started

Install dependencies and run the dev server:

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Key concepts

- **Mock content client** — fixture-based, works offline and in Storybook
- **Slot renderer** — dispatches on \`_meta.schema\`; unknown types fall back to a \`<Placeholder>\`
- **Atomic design** — atoms → molecules → organisms, all token-driven

> Brands override design tokens under \`[data-brand]\` without touching component files.

---

For more detail, see the [ADR index](/docs/architecture).`

const INLINE_SAMPLE = `This is a paragraph with **bold**, _italic_, and \`inline code\` formatting, plus a [link to Amplience](https://amplience.com).`

const LIST_SAMPLE = `### Supported content types

**Organisms (page blocks):**
1. HeroBlock
2. ImageBlock
3. GridBlock
4. ColumnsBlock
5. MarkdownBlock

**Molecules (composable units):**
- MediaCard
- Markdown`

const CODE_SAMPLE = `### Mock content client

\`\`\`typescript
const client = makeMockContentClient()
const slot = await client.getByKey<SlotBody>('home/main', { depth: 'all' })
\`\`\``

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const FullSample: Story = {
  name: 'Full — headings, lists, code, blockquote, hr',
  args: { content: FULL_SAMPLE },
}

export const InlineFormatting: Story = {
  name: 'Inline formatting — bold, italic, code, link',
  args: { content: INLINE_SAMPLE },
}

export const Lists: Story = {
  name: 'Lists — ordered and unordered',
  args: { content: LIST_SAMPLE },
}

export const CodeBlock: Story = {
  name: 'Code block',
  args: { content: CODE_SAMPLE },
}

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: { content: FULL_SAMPLE },
}
