// @vitest-environment jsdom
//
// Tests for the Carousel molecule.
//
// jsdom has no layout engine — offsetLeft, clientWidth and scrollWidth all
// report 0 — and it doesn't implement ResizeObserver or scrollTo/scrollBy. All
// three are supplied here:
//
//   - a ResizeObserver stub that records its targets and whether it was
//     disconnected, and whose callback the test fires by hand. Firing by hand
//     rather than on observe() is what makes the pre-measurement render
//     observable; the real observer's fire-on-observe behaviour is covered
//     instead by asserting *what* gets observed, since observing the track is
//     precisely what produces the initial measurement in a browser.
//   - explicit per-element geometry defined on the rendered nodes.
//   - scrollTo/scrollBy spies that record their arguments and move a backing
//     scrollLeft, plus a settle() that fires the scroll event the browser would
//     — so a press and the state it produces can be asserted end to end.
//
// The geometry is stated in each fixture rather than inferred from CSS, which
// makes the arithmetic under test explicit: with slides 100px apart in a 300px
// track, only four of six slides can reach the leading edge.
//
// CSS module classes are empty strings in the test environment and are not
// asserted.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Carousel, type CarouselProps } from './Carousel'

// ---------------------------------------------------------------------------
// ResizeObserver stub
// ---------------------------------------------------------------------------

type StubObserver = {
  readonly callback: () => void
  readonly targets: Element[]
  disconnected: boolean
}

const observers: StubObserver[] = []

class StubResizeObserver {
  private readonly entry: StubObserver

  constructor(callback: () => void) {
    this.entry = { callback, targets: [], disconnected: false }
    observers.push(this.entry)
  }

  observe(target: Element): void {
    this.entry.targets.push(target)
  }

  unobserve(target: Element): void {
    const index = this.entry.targets.indexOf(target)
    if (index !== -1) this.entry.targets.splice(index, 1)
  }

  disconnect(): void {
    this.entry.disconnected = true
    this.entry.targets.length = 0
  }
}

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('ResizeObserver', StubResizeObserver)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Fire every live ResizeObserver callback, as a real resize would. */
function triggerResize(): void {
  act(() => {
    for (const observer of observers) {
      if (!observer.disconnected) observer.callback()
    }
  })
}

/** The observer currently in force — the most recent one the effect created. */
function liveObserver(): StubObserver | undefined {
  return observers.filter((observer) => !observer.disconnected).at(-1)
}

// ---------------------------------------------------------------------------
// Geometry harness
// ---------------------------------------------------------------------------

type Geometry = {
  /** Visible width of the track. */
  readonly clientWidth: number
  /** Total width of the content — all slides plus the gaps between them. */
  readonly scrollWidth: number
  /** offsetLeft of each slide wrapper, in document order. */
  readonly offsets: readonly number[]
}

function applyGeometry(geometry: Geometry) {
  const track = screen.getByRole('group', { name: 'Slides' })
  let scrollLeft = 0

  Object.defineProperty(track, 'clientWidth', {
    configurable: true,
    get: () => geometry.clientWidth,
  })
  Object.defineProperty(track, 'scrollWidth', {
    configurable: true,
    get: () => geometry.scrollWidth,
  })
  Object.defineProperty(track, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (next: number) => {
      scrollLeft = next
    },
  })

  geometry.offsets.forEach((offset, index) => {
    const slide = track.children[index]
    if (slide) {
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, get: () => offset })
    }
  })

  const scrollTo = vi.fn((options: ScrollToOptions) => {
    scrollLeft = options.left ?? scrollLeft
  })
  const scrollBy = vi.fn((options: ScrollToOptions) => {
    scrollLeft += options.left ?? 0
  })
  track.scrollTo = scrollTo as unknown as typeof track.scrollTo
  track.scrollBy = scrollBy as unknown as typeof track.scrollBy

  return {
    track,
    scrollTo,
    scrollBy,
    /** Put the track at `position` and let the component re-measure. */
    scrollToPosition: (position: number) => {
      scrollLeft = position
      fireEvent.scroll(track)
    },
    /**
     * Fire the scroll event the browser emits once a programmatic scroll has
     * landed, so a press can be followed through to the state it produces.
     */
    settle: () => {
      fireEvent.scroll(track)
    },
  }
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function slideNodes(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} data-testid={`slide-${index}`}>
      Slide {index + 1}
    </div>
  ))
}

function renderCarousel(props: Partial<CarouselProps> = {}, slideCount = 6) {
  return render(<Carousel {...props}>{slideNodes(slideCount)}</Carousel>)
}

/**
 * The standard fixture: six slides 100px apart in a 300px track.
 *
 * maxScroll is 300, which lands exactly on the fourth slide's offset — so the
 * snap positions are 0/100/200/300 and no end position is appended.
 */
const SIX_OF_THREE: Geometry = {
  clientWidth: 300,
  scrollWidth: 600,
  offsets: [0, 100, 200, 300, 400, 500],
}

/**
 * A fractional fixture: 1.2 slides visible in a 375px track, so the slides do
 * *not* divide the track evenly.
 *
 * maxScroll is 1563.8, which falls between the fifth slide's offset (1303.2)
 * and the sixth's (1629). The sixth slide is therefore partly reachable via the
 * end of the track but can never sit at the leading edge, which is why the end
 * position is appended as a snap position in its own right.
 */
const FRACTIONAL_PEEK: Geometry = {
  clientWidth: 375,
  scrollWidth: 1938.8,
  offsets: [0, 325.8, 651.6, 977.4, 1303.2, 1629],
}

/** Three slides that all fit — nothing to scroll, so no controls. */
const FITS_EXACTLY: Geometry = {
  clientWidth: 300,
  scrollWidth: 300,
  offsets: [0, 100, 200],
}

function prevArrow() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Previous slide' })
}

function nextArrow() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Next slide' })
}

function dots() {
  return screen.queryAllByRole('button', { name: /^Go to slide/ })
}

function currentDotIndex() {
  return dots().findIndex((dot) => dot.getAttribute('aria-current') === 'true')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Carousel', () => {
  describe('structure', () => {
    it('renders its children as slides', () => {
      renderCarousel()
      expect(screen.getByTestId('slide-0').textContent).toBe('Slide 1')
      expect(screen.getByTestId('slide-5').textContent).toBe('Slide 6')
    })

    it('renders with no children', () => {
      const { container } = render(<Carousel />)
      expect(container.querySelector('.Carousel')).toBeTruthy()
    })

    it('forwards additional class names', () => {
      const { container } = renderCarousel({ className: 'custom' })
      expect(container.querySelector('.Carousel')?.className).toContain('custom')
    })

    it('drops the empty slots a conditional child leaves behind', () => {
      render(
        <Carousel>
          <div data-testid="real">Real</div>
          {false}
          {null}
        </Carousel>,
      )
      expect(screen.getByRole('group', { name: '1 of 1' })).toBeTruthy()
      expect(screen.queryByRole('group', { name: '2 of 2' })).toBeNull()
    })
  })

  describe('accessibility', () => {
    it('describes itself as a carousel with a default label', () => {
      renderCarousel()
      const root = screen.getByRole('group', { name: 'Carousel' })
      expect(root.getAttribute('aria-roledescription')).toBe('carousel')
    })

    it('uses a supplied label', () => {
      renderCarousel({ label: 'Featured products' })
      expect(screen.getByRole('group', { name: 'Featured products' })).toBeTruthy()
    })

    it('makes the track keyboard-focusable', () => {
      renderCarousel()
      expect(screen.getByRole('group', { name: 'Slides' }).getAttribute('tabindex')).toBe('0')
    })

    it('announces each slide with its position in the set', () => {
      renderCarousel({}, 3)
      const second = screen.getByRole('group', { name: '2 of 3' })
      expect(second.getAttribute('aria-roledescription')).toBe('slide')
      expect(second.contains(screen.getByTestId('slide-1'))).toBe(true)
    })

    it('points every control at the track via aria-controls', () => {
      renderCarousel()
      const { track } = applyGeometry(SIX_OF_THREE)
      triggerResize()

      const trackId = track.getAttribute('id')
      expect(trackId).toBeTruthy()
      expect(nextArrow().getAttribute('aria-controls')).toBe(trackId)
      expect(prevArrow().getAttribute('aria-controls')).toBe(trackId)
      for (const dot of dots()) {
        expect(dot.getAttribute('aria-controls')).toBe(trackId)
      }
    })
  })

  describe('CSS custom properties', () => {
    it('sets the per-breakpoint slide counts', () => {
      const { container } = renderCarousel({
        slidesMobile: 1.2,
        slidesTablet: 2,
        slidesDesktop: 4,
      })
      const style = container.querySelector('.Carousel')?.getAttribute('style') ?? ''
      expect(style).toContain('--carousel-slides-mobile: 1.2')
      expect(style).toContain('--carousel-slides-tablet: 2')
      expect(style).toContain('--carousel-slides-desktop: 4')
    })

    it('sets --carousel-gap when gap is provided', () => {
      const { container } = renderCarousel({ gap: 32 })
      expect(container.querySelector('.Carousel')?.getAttribute('style')).toContain(
        '--carousel-gap: 32px',
      )
    })

    it('leaves --carousel-gap to the token when gap is omitted', () => {
      const { container } = renderCarousel()
      expect(container.querySelector('.Carousel')?.getAttribute('style')).not.toContain(
        '--carousel-gap',
      )
    })
  })

  describe('scrollbar', () => {
    it('is hidden by default', () => {
      const { container } = renderCarousel()
      expect(container.querySelector('.Carousel')?.getAttribute('data-scrollbar')).toBe('false')
    })

    it('is shown when opted into', () => {
      const { container } = renderCarousel({ showScrollbar: true })
      expect(container.querySelector('.Carousel')?.getAttribute('data-scrollbar')).toBe('true')
    })
  })

  describe('measurement wiring', () => {
    it('renders no controls until measured', () => {
      renderCarousel()
      expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull()
      expect(dots()).toHaveLength(0)
    })

    it('observes the track and every slide', () => {
      renderCarousel({}, 4)
      const track = screen.getByRole('group', { name: 'Slides' })

      // Observing the track is what produces the initial measurement in a
      // browser; observing each slide is what catches a slide growing after
      // its image loads, which never changes the track's own box.
      const targets = liveObserver()?.targets ?? []
      expect(targets).toContain(track)
      expect(targets).toHaveLength(1 + 4)
      for (const slide of Array.from(track.children)) expect(targets).toContain(slide)
    })

    it('re-observes when slides are added', () => {
      const { rerender } = renderCarousel({}, 3)
      expect(liveObserver()?.targets).toHaveLength(1 + 3)

      rerender(<Carousel>{slideNodes(6)}</Carousel>)
      expect(liveObserver()?.targets).toHaveLength(1 + 6)
    })

    it('disconnects the observer on unmount', () => {
      const { unmount } = renderCarousel()
      expect(liveObserver()).toBeTruthy()
      unmount()
      expect(liveObserver()).toBeUndefined()
    })

    it('neither observes nor listens when both controls are off', () => {
      renderCarousel({ showArrows: false, showDots: false })
      expect(observers).toHaveLength(0)
    })
  })

  describe('once measured — overflowing track', () => {
    it('renders one dot per reachable snap position, not per slide', () => {
      renderCarousel()
      applyGeometry(SIX_OF_THREE)
      triggerResize()
      expect(dots()).toHaveLength(4)
    })

    it('marks the leading slide as current and labels dots with the total', () => {
      renderCarousel()
      applyGeometry(SIX_OF_THREE)
      triggerResize()

      const [first] = dots()
      expect(first?.getAttribute('aria-current')).toBe('true')
      expect(first?.getAttribute('aria-label')).toBe('Go to slide 1 of 4')
      expect(dots()[1]?.hasAttribute('aria-current')).toBe(false)
    })

    it('disables only the previous arrow at the start', () => {
      renderCarousel()
      applyGeometry(SIX_OF_THREE)
      triggerResize()
      expect(prevArrow().disabled).toBe(true)
      expect(nextArrow().disabled).toBe(false)
    })

    it('disables only the next arrow at the end', () => {
      renderCarousel()
      const { scrollToPosition } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      scrollToPosition(300)

      expect(prevArrow().disabled).toBe(false)
      expect(nextArrow().disabled).toBe(true)
      expect(currentDotIndex()).toBe(3)
    })

    it('enables both arrows mid-track', () => {
      renderCarousel()
      const { scrollToPosition } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      scrollToPosition(120)

      expect(prevArrow().disabled).toBe(false)
      expect(nextArrow().disabled).toBe(false)
    })

    it('marks the nearest snap position current when scrolled off a snap point', () => {
      renderCarousel()
      const { scrollToPosition } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      scrollToPosition(180)

      expect(currentDotIndex()).toBe(2)
    })

    it('tolerates a sub-pixel remainder at the end of the track', () => {
      renderCarousel()
      const { scrollToPosition } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      scrollToPosition(299.4)

      expect(nextArrow().disabled).toBe(true)
    })

    it('ignores a slide the browser has not laid out', () => {
      // A `display: none` slide reports an offsetLeft of 0, which would
      // otherwise inject a duplicate snap position and shift every dot.
      renderCarousel({}, 4)
      applyGeometry({ clientWidth: 300, scrollWidth: 600, offsets: [0, 0, 100, 200] })
      triggerResize()

      // 0 / 100 / 200, plus the end of the track at 300.
      expect(dots()).toHaveLength(4)
    })
  })

  describe('once measured — slides that do not divide the track evenly', () => {
    it('treats the end of the track as a snap position of its own', () => {
      renderCarousel()
      applyGeometry(FRACTIONAL_PEEK)
      triggerResize()

      // Five slide offsets are in range, plus the end of the track — so the
      // final slide, reachable only by scrolling to the end, still gets a dot.
      expect(dots()).toHaveLength(6)
    })

    it('keeps the next arrow enabled while a dot beyond the current one remains', () => {
      renderCarousel()
      const { scrollToPosition } = applyGeometry(FRACTIONAL_PEEK)
      triggerResize()
      scrollToPosition(1303.2)

      expect(currentDotIndex()).toBe(4)
      expect(nextArrow().disabled).toBe(false)
    })

    it('disables the next arrow only once the end is reached', () => {
      renderCarousel()
      const { scrollToPosition } = applyGeometry(FRACTIONAL_PEEK)
      triggerResize()
      scrollToPosition(1563.8)

      expect(currentDotIndex()).toBe(5)
      expect(nextArrow().disabled).toBe(true)
    })

    it('advances to the end of the track from the last slide offset', () => {
      renderCarousel()
      const { scrollTo, scrollToPosition } = applyGeometry(FRACTIONAL_PEEK)
      triggerResize()
      scrollToPosition(1303.2)
      fireEvent.click(nextArrow())

      expect(scrollTo).toHaveBeenCalledWith({ left: 1563.8 })
    })
  })

  describe('once measured — track that fits', () => {
    it('renders no arrows and no dots', () => {
      renderCarousel({}, 3)
      applyGeometry(FITS_EXACTLY)
      triggerResize()

      expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Previous slide' })).toBeNull()
      expect(dots()).toHaveLength(0)
    })

    it('handles an empty track', () => {
      render(<Carousel />)
      applyGeometry({ clientWidth: 300, scrollWidth: 300, offsets: [] })
      triggerResize()

      expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull()
      expect(dots()).toHaveLength(0)
    })

    it('gives a single oversized slide somewhere to scroll to', () => {
      renderCarousel({}, 1)
      const { scrollTo } = applyGeometry({ clientWidth: 100, scrollWidth: 200, offsets: [0] })
      triggerResize()

      // One slide, two positions: its leading edge and the end of the track.
      expect(dots()).toHaveLength(2)
      fireEvent.click(nextArrow())
      expect(scrollTo).toHaveBeenCalledWith({ left: 100 })
    })
  })

  describe('arrows — scrollStep "slide" (default)', () => {
    it('advances to the next snap position', () => {
      renderCarousel()
      const { scrollTo } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      fireEvent.click(nextArrow())

      expect(scrollTo).toHaveBeenCalledWith({ left: 100 })
    })

    it('retreats to the previous snap position', () => {
      renderCarousel()
      const { scrollTo, scrollToPosition } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      scrollToPosition(200)
      fireEvent.click(prevArrow())

      expect(scrollTo).toHaveBeenCalledWith({ left: 100 })
    })

    it('omits the scroll behavior so CSS (and reduced motion) decides', () => {
      renderCarousel()
      const { scrollTo } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      fireEvent.click(nextArrow())

      expect(Object.keys(scrollTo.mock.calls[0]?.[0] ?? {})).toEqual(['left'])
    })

    it('moves the current dot and the arrow states once the scroll lands', () => {
      renderCarousel()
      const { settle } = applyGeometry(SIX_OF_THREE)
      triggerResize()

      fireEvent.click(nextArrow())
      settle()
      expect(currentDotIndex()).toBe(1)
      expect(prevArrow().disabled).toBe(false)

      fireEvent.click(nextArrow())
      settle()
      fireEvent.click(nextArrow())
      settle()
      expect(currentDotIndex()).toBe(3)
      expect(nextArrow().disabled).toBe(true)
    })
  })

  describe('arrows — scrollStep "page"', () => {
    it('advances by a full track width', () => {
      renderCarousel({ scrollStep: 'page' })
      const { scrollBy } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      fireEvent.click(nextArrow())

      expect(scrollBy).toHaveBeenCalledWith({ left: 300 })
    })

    it('retreats by a full track width', () => {
      renderCarousel({ scrollStep: 'page' })
      const { scrollBy, scrollToPosition } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      scrollToPosition(300)
      fireEvent.click(prevArrow())

      expect(scrollBy).toHaveBeenCalledWith({ left: -300 })
    })
  })

  describe('dots', () => {
    it('scrolls to the chosen snap position', () => {
      renderCarousel()
      const { scrollTo } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      fireEvent.click(dots()[2]!)

      expect(scrollTo).toHaveBeenCalledWith({ left: 200 })
    })

    it('becomes current once the scroll lands', () => {
      renderCarousel()
      const { settle } = applyGeometry(SIX_OF_THREE)
      triggerResize()
      fireEvent.click(dots()[2]!)
      settle()

      expect(currentDotIndex()).toBe(2)
    })
  })

  describe('opting controls out', () => {
    it('renders no arrows when showArrows is false', () => {
      renderCarousel({ showArrows: false })
      applyGeometry(SIX_OF_THREE)
      triggerResize()

      expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull()
      expect(dots()).toHaveLength(4)
    })

    it('renders no dots when showDots is false', () => {
      renderCarousel({ showDots: false })
      applyGeometry(SIX_OF_THREE)
      triggerResize()

      expect(dots()).toHaveLength(0)
      expect(nextArrow()).toBeTruthy()
    })
  })
})
