import type { Meta, StoryObj } from '@storybook/react'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { MediaBlock } from './MediaBlock'

const meta = {
  title: 'Organisms/MediaBlock',
  component: MediaBlock,
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
} satisfies Meta<typeof MediaBlock>

export default meta
type Story = StoryObj<typeof MediaBlock>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const landscapeMedia: ContentMediaData = {
  mediaType: 'ManualImage',
  image: {
    src: 'https://picsum.photos/seed/ql-mediablock/1600/900',
    alt: 'A landscape photograph',
    width: 1600,
    height: 900,
  },
}

const tallMedia: ContentMediaData = {
  mediaType: 'ManualImage',
  image: {
    src: 'https://picsum.photos/seed/ql-mediablock-tall/800/1200',
    alt: 'A portrait photograph',
    width: 800,
    height: 1200,
  },
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'Default — contained',
  render: () => <MediaBlock media={landscapeMedia} />,
}

export const FullBleed: Story = {
  name: 'Full-bleed — edge-to-edge',
  render: () => <MediaBlock media={landscapeMedia} fullBleed />,
}

export const WithCaption: Story = {
  name: 'With caption',
  render: () => (
    <MediaBlock
      media={landscapeMedia}
      caption="A scenic view from the Amplience Frontend Starter launch event."
    />
  ),
}

export const LinkedInternal: Story = {
  name: 'Linked — internal route',
  render: () => (
    <MediaBlock
      media={landscapeMedia}
      href="/products/spring-collection"
      caption="View the spring collection →"
    />
  ),
}

export const Portrait: Story = {
  name: 'Portrait image — narrow container',
  render: () => (
    <MediaBlock
      media={tallMedia}
      maxWidth="narrow"
      caption="Portrait orientation — contained to narrow max-width."
    />
  ),
}

export const BackgroundDark: Story = {
  name: 'Background — dark',
  render: () => (
    <MediaBlock
      media={landscapeMedia}
      backgroundColor="dark"
      caption="Caption on a dark background."
    />
  ),
}
