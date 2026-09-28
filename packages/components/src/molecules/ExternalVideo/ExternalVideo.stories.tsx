import type { Meta, StoryObj } from '@storybook/react'

import { mp4Video, vimeoVideo, youTubeVideo } from '../NativeVideo/sample-videos'
import { ExternalVideo } from './ExternalVideo'

const meta = {
  title: 'Molecules/ExternalVideo',
  component: ExternalVideo,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ExternalVideo>

export default meta
type Story = StoryObj<typeof ExternalVideo>

const frame = { maxWidth: 800 }

export const YouTubePlayer: Story = {
  name: 'YouTube — player (loads on click)',
  render: () => (
    <div style={frame}>
      <ExternalVideo video={youTubeVideo} playback="player" />
    </div>
  ),
}

export const YouTubeAmbient: Story = {
  name: 'YouTube — ambient',
  render: () => (
    <div style={frame}>
      <ExternalVideo video={youTubeVideo} playback="ambient" />
    </div>
  ),
}

export const VimeoPlayer: Story = {
  name: 'Vimeo — player',
  render: () => (
    <div style={frame}>
      <ExternalVideo video={vimeoVideo} playback="player" />
    </div>
  ),
}

export const VimeoAmbient: Story = {
  name: 'Vimeo — ambient (background mode)',
  render: () => (
    <div style={frame}>
      <ExternalVideo video={vimeoVideo} playback="ambient" />
    </div>
  ),
}

export const Mp4Player: Story = {
  name: '.mp4 — player',
  render: () => (
    <div style={frame}>
      <ExternalVideo video={mp4Video} playback="player" />
    </div>
  ),
}

export const Mp4Ambient: Story = {
  name: '.mp4 — ambient loop',
  render: () => (
    <div style={frame}>
      <ExternalVideo video={mp4Video} playback="ambient" />
    </div>
  ),
}
