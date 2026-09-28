// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExternalVideoData } from '@amplience/frontend-starter-types'

import { AMBIENT_EMBED_TIMEOUT_MS, ExternalVideo } from './ExternalVideo'

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    priority,
    fill: _fill,
    ...props
  }: {
    src: string
    alt: string
    priority?: boolean
    fill?: boolean
  }) => <img src={src} alt={alt} data-priority={priority ? 'true' : undefined} {...props} />,
}))

let observerCallback: ((entries: { isIntersecting: boolean }[]) => void) | undefined

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: typeof observerCallback) {
        observerCallback = cb
      }
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  observerCallback = undefined
})

const youtube: ExternalVideoData = {
  mediaType: 'ExternalVideo',
  url: 'https://youtu.be/dQw4w9WgXcQ',
  title: 'Launch film',
}
const vimeo: ExternalVideoData = {
  mediaType: 'ExternalVideo',
  url: 'https://vimeo.com/76979871',
  title: 'Studio tour',
}

const iframe = (container: HTMLElement) => container.querySelector('iframe')

describe('ExternalVideo — player', () => {
  it('shows the YouTube thumbnail and a play button, and no iframe, until pressed', () => {
    const { container } = render(<ExternalVideo video={youtube} playback="player" />)
    expect(iframe(container)).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play video: Launch film' }))
    const frame = iframe(container)
    expect(frame?.getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ\?.*autoplay=1/,
    )
    expect(frame?.getAttribute('title')).toBe('Launch film')
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
  })

  it('prefers an authored poster URL', () => {
    const { container } = render(
      <ExternalVideo video={{ ...vimeo, posterUrl: 'https://x.com/p.jpg' }} playback="player" />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x.com/p.jpg')
  })

  it('has no poster image for Vimeo without one, but still a play button', () => {
    const { container } = render(<ExternalVideo video={vimeo} playback="player" />)
    expect(container.querySelector('img')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Play video: Studio tour' }))
    expect(iframe(container)?.getAttribute('src')).toBe(
      'https://player.vimeo.com/video/76979871?autoplay=1',
    )
  })

  it('marks the poster as the LCP image when the tier says so', () => {
    const { container } = render(
      <ExternalVideo video={youtube} playback="player" loadPriority="lcp" />,
    )
    expect(container.querySelector('img')?.getAttribute('data-priority')).toBe('true')
  })
})

describe('ExternalVideo — ambient', () => {
  it('mounts an inert, control-less embed once on screen', () => {
    const { container } = render(<ExternalVideo video={youtube} playback="ambient" />)
    expect(iframe(container)).toBeNull()
    act(() => observerCallback?.([{ isIntersecting: true }]))
    const frame = iframe(container)
    expect(frame?.getAttribute('src')).toContain('mute=1')
    expect(frame?.parentElement?.hasAttribute('inert')).toBe(true)
  })

  /** Mounts an on-screen ambient embed with a fake window, and loads it. */
  function mountAmbient(video: ExternalVideoData) {
    const utils = render(<ExternalVideo video={video} playback="ambient" />)
    act(() => observerCallback?.([{ isIntersecting: true }]))
    const frame = iframe(utils.container)!
    const postMessage = vi.fn()
    const frameWindow = { postMessage }
    Object.defineProperty(frame, 'contentWindow', { value: frameWindow })
    const commands = () =>
      postMessage.mock.calls
        .map(([message]) => message as string)
        .filter((message) => /"method":"(play|pause)"|"func"/.test(message))
    /** Simulates a message from the embed (or, with `source`, from elsewhere). */
    const receive = (data: string, origin: string, source: unknown = frameWindow) => {
      const event = new Event('message')
      Object.defineProperties(event, {
        data: { value: data },
        origin: { value: origin },
        source: { value: source },
      })
      act(() => {
        window.dispatchEvent(event)
      })
    }
    return { ...utils, frame, postMessage, commands, receive }
  }

  it('pauses and resumes the embed over postMessage without reloading it', () => {
    const { container, frame, commands } = mountAmbient(vimeo)
    fireEvent.load(frame)
    // Once loaded, the current state is sent straight away.
    expect(commands().at(-1)).toBe('{"method":"play"}')

    fireEvent.click(screen.getByRole('button', { name: 'Pause background video' }))
    expect(commands().at(-1)).toBe('{"method":"pause"}')
    fireEvent.click(screen.getByRole('button', { name: 'Play background video' }))
    expect(commands().at(-1)).toBe('{"method":"play"}')
    expect(iframe(container)).toBe(frame)
  })

  it('never mounts the embed for visitors who prefer reduced motion, until they press play', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    const { container } = render(<ExternalVideo video={youtube} playback="ambient" />)
    act(() => observerCallback?.([{ isIntersecting: true }]))
    expect(iframe(container)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Play background video' }))
    expect(iframe(container)).not.toBeNull()
  })

  it('holds commands until the embed loads, then sends the latest state', () => {
    vi.useFakeTimers()
    const { frame, commands } = mountAmbient(youtube)

    // Paused while the embed is still loading: nothing can be sent yet.
    fireEvent.click(screen.getByRole('button', { name: 'Pause background video' }))
    expect(commands()).toEqual([])

    fireEvent.load(frame)
    const pause = '{"event":"command","func":"pauseVideo","args":[]}'
    expect(commands()).toEqual([pause])
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(commands()).toEqual([pause, pause])
    vi.useRealTimers()
  })

  it('stays hidden behind the poster until YouTube reports it is playing', () => {
    const { frame, postMessage, receive } = mountAmbient(youtube)
    fireEvent.load(frame)
    expect(postMessage).toHaveBeenCalledWith(
      '{"event":"listening","id":1,"channel":"widget"}',
      'https://www.youtube.com',
    )
    const wrapper = frame.parentElement!
    expect(wrapper.hasAttribute('data-confirmed')).toBe(false)

    // A message from any other origin or window is ignored.
    receive('{"event":"onStateChange","info":1}', 'https://evil.example')
    receive('{"event":"onStateChange","info":1}', 'https://www.youtube.com', window)
    expect(wrapper.hasAttribute('data-confirmed')).toBe(false)

    receive('{"event":"onStateChange","info":1}', 'https://www.youtube.com')
    expect(wrapper.hasAttribute('data-confirmed')).toBe(true)
  })

  it('falls back to the poster, with no toggle, if the embed never plays (e.g. a bot check)', () => {
    vi.useFakeTimers()
    const { container, frame } = mountAmbient(youtube)
    fireEvent.load(frame)
    act(() => {
      vi.advanceTimersByTime(AMBIENT_EMBED_TIMEOUT_MS)
    })
    expect(iframe(container)).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toContain('hqdefault')
    vi.useRealTimers()
  })

  it('keeps a confirmed embed past the timeout', () => {
    vi.useFakeTimers()
    const { container, frame, receive } = mountAmbient(vimeo)
    fireEvent.load(frame)
    receive('{"event":"timeupdate","data":{"seconds":0.3}}', 'https://player.vimeo.com')
    act(() => {
      vi.advanceTimersByTime(AMBIENT_EMBED_TIMEOUT_MS * 2)
    })
    expect(iframe(container)).toBe(frame)
    vi.useRealTimers()
  })

  it('inside a link, has no toggle and only mounts the embed on hover', () => {
    const { container } = render(
      <a href="/elsewhere">
        <ExternalVideo video={youtube} playback="ambient" ambientTrigger="hover" />
      </a>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    act(() => observerCallback?.([{ isIntersecting: true }]))
    expect(iframe(container)).toBeNull()
    fireEvent.pointerEnter(screen.getByRole('link'))
    expect(iframe(container)).not.toBeNull()
  })
})

it('goes back to the facade when the video changes', () => {
  const { container, rerender } = render(<ExternalVideo video={youtube} playback="player" />)
  fireEvent.click(screen.getByRole('button', { name: 'Play video: Launch film' }))
  expect(iframe(container)).not.toBeNull()
  rerender(<ExternalVideo video={vimeo} playback="player" />)
  expect(iframe(container)).toBeNull()
  expect(screen.getByRole('button', { name: 'Play video: Studio tour' })).toBeTruthy()
})

describe('ExternalVideo — other URLs', () => {
  it('plays a direct .mp4 in a native video', () => {
    const { container } = render(
      <ExternalVideo
        video={{ ...youtube, url: 'https://cdn.example.com/loop.mp4', posterUrl: '/p.jpg' }}
        playback="ambient"
      />,
    )
    expect(iframe(container)).toBeNull()
    expect(container.querySelector('video source')?.getAttribute('src')).toBe(
      'https://cdn.example.com/loop.mp4',
    )
    expect(container.querySelector('video')?.getAttribute('poster')).toBe('/p.jpg')
  })

  it('renders nothing, with a warning, for an unsupported URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { container } = render(
      <ExternalVideo video={{ ...youtube, url: 'https://example.com/clip' }} playback="player" />,
    )
    expect(container.innerHTML).toBe('')
    expect(warn).toHaveBeenCalledWith('[ExternalVideo] unsupported video URL — skipping render', {
      url: 'https://example.com/clip',
    })
  })
})
