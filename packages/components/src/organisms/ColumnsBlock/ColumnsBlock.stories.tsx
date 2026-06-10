import type { Meta, StoryObj } from '@storybook/react'
import type { CSSProperties } from 'react'

import { ColumnsBlock } from './ColumnsBlock'

const meta = {
  title: 'Organisms/ColumnsBlock',
  component: ColumnsBlock,
  tags: ['autodocs'],
  argTypes: {
    gap: {
      control: { type: 'range', min: 0, max: 64, step: 4 },
    },
    maxWidth: {
      control: 'radio',
      options: ['narrow', 'default', 'wide', 'full'],
    },
    backgroundColor: {
      control: 'select',
      options: [undefined, 'primary', 'secondary', 'tertiary', 'white', 'light', 'dark', 'black'],
    },
  },
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ColumnsBlock>

export default meta
type Story = StoryObj<typeof ColumnsBlock>

// ---------------------------------------------------------------------------
// Placeholder child helper
// ---------------------------------------------------------------------------

const placeholderStyle: CSSProperties = {
  background: 'var(--color-gray-200)',
  border: '2px dashed var(--color-gray-400)',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '160px',
  fontFamily: 'sans-serif',
  fontSize: '14px',
  color: 'var(--color-gray-600)',
}

function Placeholder({ label }: { label: string }) {
  return <div style={placeholderStyle}>{label}</div>
}

// ---------------------------------------------------------------------------
// Playground — all controls enabled
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    maxWidth: 'default',
  },
  render: (args) => (
    <ColumnsBlock {...args}>
      <Placeholder label="Column 1" />
      <Placeholder label="Column 2" />
      <Placeholder label="Column 3" />
    </ColumnsBlock>
  ),
}

// ---------------------------------------------------------------------------
// Column count variants
// ---------------------------------------------------------------------------

export const TwoColumns: Story = {
  name: 'Two columns',
  render: () => (
    <ColumnsBlock>
      <Placeholder label="Column 1" />
      <Placeholder label="Column 2" />
    </ColumnsBlock>
  ),
}

export const ThreeColumns: Story = {
  name: 'Three columns',
  render: () => (
    <ColumnsBlock>
      <Placeholder label="Column 1" />
      <Placeholder label="Column 2" />
      <Placeholder label="Column 3" />
    </ColumnsBlock>
  ),
}

export const FourColumns: Story = {
  name: 'Four columns',
  render: () => (
    <ColumnsBlock>
      <Placeholder label="Column 1" />
      <Placeholder label="Column 2" />
      <Placeholder label="Column 3" />
      <Placeholder label="Column 4" />
    </ColumnsBlock>
  ),
}

// ---------------------------------------------------------------------------
// Background colours
// ---------------------------------------------------------------------------

export const BackgroundLight: Story = {
  name: 'Background — light',
  render: () => (
    <ColumnsBlock backgroundColor="light">
      <Placeholder label="Column 1" />
      <Placeholder label="Column 2" />
    </ColumnsBlock>
  ),
}

export const BackgroundPrimary: Story = {
  name: 'Background — primary',
  render: () => (
    <ColumnsBlock backgroundColor="primary">
      <Placeholder label="Column 1" />
      <Placeholder label="Column 2" />
    </ColumnsBlock>
  ),
}

// ---------------------------------------------------------------------------
// Never wraps
// ---------------------------------------------------------------------------

export const NeverWraps: Story = {
  name: 'Never wraps — 5 columns (resize to verify)',
  render: () => (
    <ColumnsBlock>
      <Placeholder label="Col 1" />
      <Placeholder label="Col 2" />
      <Placeholder label="Col 3" />
      <Placeholder label="Col 4" />
      <Placeholder label="Col 5" />
    </ColumnsBlock>
  ),
}
