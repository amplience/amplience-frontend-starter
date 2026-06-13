import type { Meta, StoryObj } from '@storybook/react'
import type { CSSProperties } from 'react'

import { GridBlock } from './GridBlock'

const meta = {
  title: 'Organisms/GridBlock',
  component: GridBlock,
  tags: ['autodocs'],
  argTypes: {
    sizingMode: {
      control: 'radio',
      options: ['fixed', 'auto'],
    },
    columnsMobile: {
      control: { type: 'number', min: 1, max: 6 },
    },
    columnsTablet: {
      control: { type: 'number', min: 1, max: 6 },
    },
    columnsDesktop: {
      control: { type: 'number', min: 1, max: 6 },
    },
    minItemWidth: {
      control: { type: 'number', min: 100, max: 600, step: 10 },
    },
    gap: {
      control: { type: 'range', min: 0, max: 64, step: 4 },
    },
    maxWidth: {
      control: 'radio',
      options: ['narrow', 'default', 'wide', 'none'],
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
} satisfies Meta<typeof GridBlock>

export default meta
type Story = StoryObj<typeof GridBlock>

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
  minHeight: '120px',
  fontFamily: 'sans-serif',
  fontSize: '14px',
  color: 'var(--color-gray-600)',
}

function Placeholder({ label }: { label: string }) {
  return <div style={placeholderStyle}>{label}</div>
}

const sixItems = Array.from({ length: 6 }, (_, i) => (
  <Placeholder key={i} label={`Item ${i + 1}`} />
))

// ---------------------------------------------------------------------------
// Playground — all controls enabled
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    sizingMode: 'fixed',
    columnsMobile: 1,
    columnsTablet: 2,
    columnsDesktop: 3,
    minItemWidth: 250,
    maxWidth: 'default',
  },
  render: (args) => <GridBlock {...args}>{sixItems}</GridBlock>,
}

// ---------------------------------------------------------------------------
// Fixed — breakpoint columns
// ---------------------------------------------------------------------------

export const Fixed1_2_3: Story = {
  name: 'Fixed — 1 / 2 / 3 columns',
  render: () => (
    <GridBlock columnsMobile={1} columnsTablet={2} columnsDesktop={3}>
      {sixItems}
    </GridBlock>
  ),
}

export const Fixed1_2_4: Story = {
  name: 'Fixed — 1 / 2 / 4 columns',
  render: () => (
    <GridBlock columnsMobile={1} columnsTablet={2} columnsDesktop={4}>
      {sixItems}
    </GridBlock>
  ),
}

export const Fixed2_2_2: Story = {
  name: 'Fixed — 2 columns at all breakpoints',
  render: () => (
    <GridBlock columnsMobile={2} columnsTablet={2} columnsDesktop={2}>
      {sixItems}
    </GridBlock>
  ),
}

// ---------------------------------------------------------------------------
// Auto mode
// ---------------------------------------------------------------------------

export const Auto250: Story = {
  name: 'Auto — min item width 250px',
  render: () => (
    <GridBlock sizingMode="auto" minItemWidth={250}>
      {sixItems}
    </GridBlock>
  ),
}

export const Auto180: Story = {
  name: 'Auto — min item width 180px (more columns)',
  render: () => (
    <GridBlock sizingMode="auto" minItemWidth={180}>
      {sixItems}
    </GridBlock>
  ),
}

// ---------------------------------------------------------------------------
// Background colours
// ---------------------------------------------------------------------------

export const BackgroundLight: Story = {
  name: 'Background — light',
  render: () => (
    <GridBlock backgroundColor="light" columnsMobile={1} columnsTablet={2} columnsDesktop={3}>
      {sixItems}
    </GridBlock>
  ),
}

export const BackgroundDark: Story = {
  name: 'Background — dark',
  render: () => (
    <GridBlock backgroundColor="dark" columnsMobile={1} columnsTablet={2} columnsDesktop={3}>
      {sixItems}
    </GridBlock>
  ),
}

// ---------------------------------------------------------------------------
// Wide container
// ---------------------------------------------------------------------------

export const WideContainer: Story = {
  name: 'Wide container — 4 columns desktop',
  render: () => (
    <GridBlock maxWidth="wide" columnsMobile={1} columnsTablet={2} columnsDesktop={4}>
      {sixItems}
    </GridBlock>
  ),
}
