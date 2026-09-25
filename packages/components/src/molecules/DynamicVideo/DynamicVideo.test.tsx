// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { DynamicVideoData } from '@amplience/frontend-starter-types'

import { DynamicVideo } from './DynamicVideo'

afterEach(cleanup)

const video: DynamicVideoData = {
  mediaType: 'DynamicVideo',
  video: { name: 'Zoe_Saldana', endpoint: 'quadraticdemo', defaultHost: 'cdn.media.amplience.net' },
  title: 'Interview',
}

const sourcesOf = (container: HTMLElement) =>
  [...container.querySelectorAll('source')].map((s) => s.getAttribute('src'))

describe('DynamicVideo', () => {
  it('offers the DAM transcode renditions', () => {
    const { container } = render(<DynamicVideo video={video} playback="player" />)
    expect(sourcesOf(container)).toEqual([
      'https://cdn.media.amplience.net/v/quadraticdemo/Zoe_Saldana/mp4_720p',
      'https://cdn.media.amplience.net/v/quadraticdemo/Zoe_Saldana/mp4_1080p',
      'https://cdn.media.amplience.net/v/quadraticdemo/Zoe_Saldana/mp4_720p',
      'https://cdn.media.amplience.net/v/quadraticdemo/Zoe_Saldana/mp4_480p',
    ])
  })

  it('uses a custom profile list when given one', () => {
    const { container } = render(
      <DynamicVideo
        video={video}
        playback="player"
        profiles={[{ profile: 'mp4_1440p', type: 'video/mp4' }]}
      />,
    )
    expect(sourcesOf(container)).toEqual([
      'https://cdn.media.amplience.net/v/quadraticdemo/Zoe_Saldana/mp4_1440p',
    ])
  })

  it('defaults the poster to the video’s DAM thumbnail', () => {
    const { container } = render(<DynamicVideo video={video} playback="player" />)
    expect(container.querySelector('video')?.getAttribute('poster')).toBe(
      'https://cdn.media.amplience.net/v/quadraticdemo/Zoe_Saldana?w=1600',
    )
  })

  it('prefers an authored poster image, served through DI', () => {
    const { container } = render(
      <DynamicVideo
        video={{
          ...video,
          poster: {
            name: 'poster',
            endpoint: 'quadraticdemo',
            defaultHost: 'cdn.media.amplience.net',
          },
        }}
        playback="player"
      />,
    )
    expect(container.querySelector('video')?.getAttribute('poster')).toBe(
      'https://cdn.media.amplience.net/i/quadraticdemo/poster?w=1600',
    )
  })

  it('passes the title and aspect ratio through', () => {
    const { container } = render(
      <DynamicVideo video={{ ...video, aspectRatio: '1:1' }} playback="player" />,
    )
    expect(container.querySelector('video')?.getAttribute('aria-label')).toBe('Interview')
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue('--video-aspect-ratio'),
    ).toBe('1 / 1')
  })

  it('renders nothing for an incomplete video link', () => {
    const { container } = render(
      <DynamicVideo
        video={{ ...video, video: { ...video.video, endpoint: '' } }}
        playback="player"
      />,
    )
    expect(container.innerHTML).toBe('')
  })
})
