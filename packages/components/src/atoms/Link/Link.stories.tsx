import type { Meta, StoryObj } from '@storybook/react'

import { Link } from './Link'

const meta = {
  title: 'Atoms/Link',
  component: Link,
  tags: ['autodocs'],
  parameters: { controls: { disable: true }, layout: 'padded' },
} satisfies Meta<typeof Link>

export default meta
type Story = StoryObj<typeof Link>

export const Internal: Story = {
  args: {
    href: '/about',
    children: 'Internal link (uses Next/Link)',
  },
}

export const External: Story = {
  args: {
    href: 'https://amplience.com',
    children: 'External link (opens in new tab)',
  },
}

export const InlineWithText: Story = {
  name: 'Inline within body text',
  render: () => (
    <p style={{ margin: 0, maxWidth: '40ch' }}>
      Learn more about <Link href="/docs">content management</Link> or visit the{' '}
      <Link href="https://amplience.com">Amplience website</Link> for full documentation.
    </p>
  ),
}

export const BothTypes: Story = {
  name: 'Internal vs external comparison',
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
      <Link href="/internal-path">Internal — /internal-path</Link>
      <Link href="https://example.com">External — https://example.com</Link>
    </div>
  ),
}
