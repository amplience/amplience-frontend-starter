import type { Meta, StoryObj } from '@storybook/react'

import { damVideo } from '../NativeVideo/sample-videos'
import { DynamicVideo } from './DynamicVideo'

const meta = {
  title: 'Molecules/DynamicVideo',
  component: DynamicVideo,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DynamicVideo>

export default meta
type Story = StoryObj<typeof DynamicVideo>

export const Player: Story = {
  name: 'Player (default)',
  render: () => (
    <div style={{ maxWidth: 800 }}>
      <DynamicVideo video={damVideo} playback="player" />
    </div>
  ),
}

export const Ambient: Story = {
  name: 'Ambient — muted loop with pause button',
  render: () => (
    <div style={{ maxWidth: 800 }}>
      <DynamicVideo video={damVideo} playback="ambient" />
    </div>
  ),
}

export const Portrait: Story = {
  name: 'Portrait frame (9:16)',
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <DynamicVideo video={{ ...damVideo, aspectRatio: '9:16' }} playback="ambient" />
    </div>
  ),
}
