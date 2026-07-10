import type { Meta, StoryObj } from '@storybook/react'

import { ManualImage } from './ManualImage'

const meta = {
  title: 'Molecules/ManualImage',
  component: ManualImage,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ManualImage>

export default meta
type Story = StoryObj<typeof ManualImage>

export const Default: Story = {
  name: 'Default',
  render: () => (
    <div style={{ maxWidth: 800 }}>
      <ManualImage
        mediaType="ManualImage"
        image={{
          src: 'https://picsum.photos/seed/ql-manual/800/450',
          alt: 'A landscape image',
          width: 800,
          height: 450,
        }}
      />
    </div>
  ),
}

export const WithAspectRatio: Story = {
  name: 'With aspect ratio override',
  render: () => (
    <div style={{ maxWidth: 800 }}>
      <ManualImage
        mediaType="ManualImage"
        image={{
          src: 'https://picsum.photos/seed/ql-manual/800/450',
          alt: 'An image with 16/9 aspect ratio override',
          width: 800,
          height: 450,
          aspectRatio: '16 / 9',
        }}
      />
    </div>
  ),
}
