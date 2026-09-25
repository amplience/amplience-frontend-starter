// @vitest-environment jsdom
//
// NativeVideo — the <video> renderer behind DynamicVideo and ExternalVideo's
// .mp4 URLs. jsdom has no media playback, IntersectionObserver or
// matchMedia, so each is stubbed to drive the ambient rules directly.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NativeVideo } from './NativeVideo'

const sources = [
  { src: 'https://cdn.example.com/v/a/mp4_720p', type: 'video/mp4', media: '(max-width: 768px)' },
  { src: 'https://cdn.example.com/v/a/mp4_1080p', type: 'video/mp4' },
]

let observerCallback: ((entries: { isIntersecting: boolean }[]) => void) | undefined
const play = vi.fn(() => Promise.resolve())
const pause = vi.fn()

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
  }))
}

const scrollIntoView = (isIntersecting: boolean) =>
  act(() => observerCallback?.([{ isIntersecting }]))

beforeEach(() => {
  setReducedMotion(false)
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
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  play.mockClear()
  pause.mockClear()
  observerCallback = undefined
})

const video = (container: HTMLElement) => container.querySelector('video')!

describe('NativeVideo — player', () => {
  it('renders a video with controls, its sources in order, and an accessible name', () => {
    const { container } = render(
      <NativeVideo sources={sources} playback="player" title="Brand film" poster="/p.jpg" />,
    )
    const el = video(container)
    expect(el.controls).toBe(true)
    expect(el.getAttribute('aria-label')).toBe('Brand film')
    expect(el.getAttribute('poster')).toBe('/p.jpg')
    const rendered = [...el.querySelectorAll('source')].map((s) => [
      s.getAttribute('src'),
      s.getAttribute('media'),
    ])
    expect(rendered).toEqual([
      ['https://cdn.example.com/v/a/mp4_720p', '(max-width: 768px)'],
      ['https://cdn.example.com/v/a/mp4_1080p', null],
    ])
  })

  it('fetches nothing but the poster when lazy, metadata when above the fold', () => {
    const { container, rerender } = render(<NativeVideo sources={sources} playback="player" />)
    expect(video(container).getAttribute('preload')).toBe('none')
    rerender(<NativeVideo sources={sources} playback="player" loadPriority="eager" />)
    expect(video(container).getAttribute('preload')).toBe('metadata')
  })

  it('never autoplays and has no ambient toggle', () => {
    render(<NativeVideo sources={sources} playback="player" />)
    scrollIntoView(true)
    expect(play).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reserves its frame from the authored aspect ratio', () => {
    const { container } = render(
      <NativeVideo sources={sources} playback="player" aspectRatio="9:16" />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--video-aspect-ratio')).toBe('9 / 16')
  })

  it('renders nothing without sources', () => {
    const { container } = render(<NativeVideo sources={[]} playback="player" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('NativeVideo — ambient', () => {
  it('is muted, looping, control-less and hidden from assistive tech', () => {
    const { container } = render(<NativeVideo sources={sources} playback="ambient" />)
    const el = video(container)
    expect(el.controls).toBe(false)
    expect(el.loop).toBe(true)
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.getAttribute('tabindex')).toBe('-1')
  })

  it('plays once on screen and pauses when scrolled away', () => {
    const { container } = render(<NativeVideo sources={sources} playback="ambient" />)
    expect(play).not.toHaveBeenCalled()
    scrollIntoView(true)
    expect(play).toHaveBeenCalledTimes(1)
    expect(video(container).muted).toBe(true)
    scrollIntoView(false)
    expect(pause).toHaveBeenCalled()
  })

  it('shows a pause button that stops it, and a play button that restarts it', () => {
    render(<NativeVideo sources={sources} playback="ambient" />)
    scrollIntoView(true)
    fireEvent.click(screen.getByRole('button', { name: 'Pause background video' }))
    expect(pause).toHaveBeenCalled()
    play.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Play background video' }))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('keeps a visitor’s pause when the video scrolls back into view', () => {
    render(<NativeVideo sources={sources} playback="ambient" />)
    scrollIntoView(true)
    fireEvent.click(screen.getByRole('button', { name: 'Pause background video' }))
    play.mockClear()
    scrollIntoView(false)
    scrollIntoView(true)
    expect(play).not.toHaveBeenCalled()
  })

  it('does not autoplay for visitors who prefer reduced motion', () => {
    setReducedMotion(true)
    render(<NativeVideo sources={sources} playback="ambient" />)
    scrollIntoView(true)
    expect(play).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play background video' })).toBeTruthy()
  })

  describe('inside a link (hover trigger)', () => {
    const renderLinked = () =>
      render(
        <a href="/somewhere">
          <NativeVideo sources={sources} playback="ambient" ambientTrigger="hover" />
        </a>,
      )

    it('has no toggle and does not play by itself', () => {
      renderLinked()
      scrollIntoView(true)
      expect(screen.queryByRole('button')).toBeNull()
      expect(play).not.toHaveBeenCalled()
    })

    it('plays while the link is hovered or focused, and stops after', () => {
      renderLinked()
      const link = screen.getByRole('link')
      fireEvent.pointerEnter(link)
      expect(play).toHaveBeenCalledTimes(1)
      fireEvent.pointerLeave(link)
      expect(pause).toHaveBeenCalled()
      fireEvent.focusIn(link)
      expect(play).toHaveBeenCalledTimes(2)
    })

    it('never plays for visitors who prefer reduced motion', () => {
      setReducedMotion(true)
      renderLinked()
      fireEvent.pointerEnter(screen.getByRole('link'))
      expect(play).not.toHaveBeenCalled()
    })
  })

  it('loads lazily below the fold and eagerly above it', () => {
    const { container, rerender } = render(<NativeVideo sources={sources} playback="ambient" />)
    expect(video(container).getAttribute('preload')).toBe('none')
    rerender(<NativeVideo sources={sources} playback="ambient" loadPriority="eager" />)
    expect(video(container).getAttribute('preload')).toBe('metadata')
  })

  it('plays straight away where IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<NativeVideo sources={sources} playback="ambient" />)
    expect(play).toHaveBeenCalledTimes(1)
  })
})

it('replaces the video element when its sources change', () => {
  const { container, rerender } = render(<NativeVideo sources={sources} playback="player" />)
  const first = video(container)
  rerender(
    <NativeVideo
      sources={[{ src: 'https://cdn.example.com/b.mp4', type: 'video/mp4' }]}
      playback="player"
    />,
  )
  expect(video(container)).not.toBe(first)
  expect(video(container).querySelector('source')?.getAttribute('src')).toBe(
    'https://cdn.example.com/b.mp4',
  )
})

it('preloads the poster only for the LCP tier', () => {
  const { rerender } = render(
    <NativeVideo sources={sources} playback="ambient" poster="/poster.jpg" loadPriority="lcp" />,
  )
  const preloadLink = () => document.querySelector('link[rel="preload"][href="/poster.jpg"]')
  expect(preloadLink()).not.toBeNull()
  rerender(
    <NativeVideo sources={sources} playback="ambient" poster="/poster.jpg" loadPriority="eager" />,
  )
  expect(preloadLink()).toBeNull()
})
