import type { Meta, StoryObj } from '@storybook/react'

import type { DynamicImageData } from '@amplience/quadratic-types'

import { DynamicImage } from './DynamicImage'

const meta = {
  title: 'Molecules/DynamicImage',
  component: DynamicImage,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof DynamicImage>

export default meta
type Story = StoryObj<typeof DynamicImage>

// ---------------------------------------------------------------------------
// Sample DAM images (using Amplience demo hub)
// ---------------------------------------------------------------------------

const heroImage: DynamicImageData = {
  mediaType: 'DynamicImage',
  image: {
    image: {
      name: '190207-homepage-date-night-slide',
      endpoint: 'quadraticdemo',
      defaultHost: 'cdn.media.amplience.net',
    },
    query: 'sm=aspect&aspect=16:9',
    aspectRatio: 1.7778,
  },
  imageAltText: 'A hero banner image from Amplience DAM',
}

const squareImage: DynamicImageData = {
  mediaType: 'DynamicImage',
  image: {
    image: {
      name: 'facial_toner_nature_scene',
      endpoint: 'quadraticdemo',
      defaultHost: 'cdn.media.amplience.net',
    },
    query: 'sm=aspect&aspect=1:1',
    aspectRatio: 1,
  },
  imageAltText: 'A product image from Amplience DAM',
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'Default',
  render: () => (
    <div style={{ maxWidth: 800 }}>
      <DynamicImage image={heroImage} />
    </div>
  ),
}

export const ProductImage: Story = {
  name: 'Product image',
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <DynamicImage image={squareImage} />
    </div>
  ),
}

export const WithPriority: Story = {
  name: 'Priority loading (above the fold)',
  render: () => (
    <div style={{ maxWidth: 800 }}>
      <DynamicImage image={heroImage} priority={true} />
    </div>
  ),
}

export const PartialWidthSizes: Story = {
  name: 'Partial width — custom sizes hint',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <DynamicImage image={squareImage} sizes="(max-width: 480px) 100vw, 360px" />
    </div>
  ),
}
