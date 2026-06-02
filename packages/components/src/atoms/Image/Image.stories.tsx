import type { Meta, StoryObj } from '@storybook/react'

import { Image } from './Image'

const meta = {
  title: 'Atoms/Image',
  component: Image,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    aspectRatio: { control: 'text' },
  },
} satisfies Meta<typeof Image>

export default meta
type Story = StoryObj<typeof Image>

export const Playground: Story = {
  args: {
    src: 'https://picsum.photos/seed/ql-story/800/400',
    alt: 'A placeholder landscape image',
    width: 800,
    height: 400,
    unoptimized: true,
  },
}

export const IntrinsicRatio: Story = {
  name: 'Intrinsic ratio (no aspectRatio)',
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <Image
        src="https://picsum.photos/seed/ql26a/800/400"
        alt="A placeholder landscape image"
        width={800}
        height={400}
        unoptimized
      />
    </div>
  ),
}

export const AspectRatioSquare: Story = {
  name: 'aspectRatio — 1 / 1',
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Image
        src="https://picsum.photos/seed/ql26a/800/400"
        alt="The same image cropped to a square"
        width={800}
        height={400}
        aspectRatio="1 / 1"
        unoptimized
      />
    </div>
  ),
}

export const AspectRatioWidescreen: Story = {
  name: 'aspectRatio — 16 / 9',
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <Image
        src="https://picsum.photos/seed/ql26b/1200/800"
        alt="A placeholder image cropped to 16:9"
        width={1200}
        height={800}
        aspectRatio="16 / 9"
        unoptimized
      />
    </div>
  ),
}

export const AspectRatioPortrait: Story = {
  name: 'aspectRatio — 3 / 4',
  render: () => (
    <div style={{ maxWidth: 240 }}>
      <Image
        src="https://picsum.photos/seed/ql26c/600/900"
        alt="A placeholder portrait image"
        width={600}
        height={900}
        aspectRatio="3 / 4"
        unoptimized
      />
    </div>
  ),
}
