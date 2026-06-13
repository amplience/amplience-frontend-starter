import type { Meta, StoryObj } from '@storybook/react'

import { ImageBlock } from './ImageBlock'

const meta = {
  title: 'Organisms/ImageBlock',
  component: ImageBlock,
  tags: ['autodocs'],
  argTypes: {
    caption: { control: 'text' },
    href: { control: 'text' },
    fullBleed: { control: 'boolean' },
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
} satisfies Meta<typeof ImageBlock>

export default meta
type Story = StoryObj<typeof ImageBlock>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const landscapeImage = {
  src: 'https://picsum.photos/seed/ql-imgblock/1600/900',
  alt: 'A landscape photograph',
  width: 1600,
  height: 900,
  unoptimized: true,
} as const

const tallImage = {
  src: 'https://picsum.photos/seed/ql-imgblock-tall/800/1200',
  alt: 'A portrait photograph',
  width: 800,
  height: 1200,
  unoptimized: true,
} as const

// ---------------------------------------------------------------------------
// Playground — all controls enabled
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    image: { ...landscapeImage },
    maxWidth: 'default',
  },
}

// ---------------------------------------------------------------------------
// Basic
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'Default — contained',
  render: () => <ImageBlock image={{ ...landscapeImage }} />,
}

export const NarrowContainer: Story = {
  name: 'Narrow container',
  render: () => <ImageBlock image={{ ...landscapeImage }} maxWidth="narrow" />,
}

export const WideContainer: Story = {
  name: 'Wide container',
  render: () => <ImageBlock image={{ ...landscapeImage }} maxWidth="wide" />,
}

// ---------------------------------------------------------------------------
// Full-bleed
// ---------------------------------------------------------------------------

export const FullBleed: Story = {
  name: 'Full-bleed — edge-to-edge',
  render: () => <ImageBlock image={{ ...landscapeImage }} fullBleed />,
}

export const FullBleedWithCaption: Story = {
  name: 'Full-bleed with caption',
  render: () => (
    <ImageBlock
      image={{ ...landscapeImage }}
      fullBleed
      caption="Photography by Jane Smith, 2024."
    />
  ),
}

// ---------------------------------------------------------------------------
// Caption
// ---------------------------------------------------------------------------

export const WithCaption: Story = {
  name: 'With caption',
  render: () => (
    <ImageBlock
      image={{ ...landscapeImage }}
      caption="A scenic view from the Quadratic Lite launch event."
    />
  ),
}

// ---------------------------------------------------------------------------
// Linked image
// ---------------------------------------------------------------------------

export const LinkedInternal: Story = {
  name: 'Linked — internal route',
  render: () => (
    <ImageBlock
      image={{ ...landscapeImage }}
      href="/products/spring-collection"
      caption="View the spring collection →"
    />
  ),
}

export const LinkedExternal: Story = {
  name: 'Linked — external URL (new tab)',
  render: () => (
    <ImageBlock
      image={{ ...landscapeImage }}
      href="https://amplience.com"
      caption="Visit Amplience"
    />
  ),
}

// ---------------------------------------------------------------------------
// Aspect ratio override
// ---------------------------------------------------------------------------

export const AspectRatioSquare: Story = {
  name: 'Aspect ratio — 1 / 1 (square crop)',
  render: () => (
    <ImageBlock image={{ ...landscapeImage, aspectRatio: '1 / 1' }} maxWidth="narrow" />
  ),
}

export const AspectRatioWide: Story = {
  name: 'Aspect ratio — 21 / 9 (ultrawide banner)',
  render: () => <ImageBlock image={{ ...landscapeImage, aspectRatio: '21 / 9' }} />,
}

// ---------------------------------------------------------------------------
// Portrait image
// ---------------------------------------------------------------------------

export const Portrait: Story = {
  name: 'Portrait image — narrow container',
  render: () => (
    <ImageBlock
      image={{ ...tallImage }}
      maxWidth="narrow"
      caption="Portrait orientation — contained to narrow max-width."
    />
  ),
}

// ---------------------------------------------------------------------------
// Background colours
// ---------------------------------------------------------------------------

export const BackgroundLight: Story = {
  name: 'Background — light',
  render: () => (
    <ImageBlock
      image={{ ...landscapeImage }}
      backgroundColor="light"
      caption="Caption on a light background."
    />
  ),
}

export const BackgroundDark: Story = {
  name: 'Background — dark',
  render: () => (
    <ImageBlock
      image={{ ...landscapeImage }}
      backgroundColor="dark"
      caption="Caption on a dark background."
    />
  ),
}
