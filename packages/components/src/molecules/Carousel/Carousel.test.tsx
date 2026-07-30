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

import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
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
  capturedPointers.clear()
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

/** Pointer IDs currently captured, backing the stubs below. */
const capturedPointers = new Set<number>()

function applyGeometry(geometry: Geometry) {
  const track = screen.getByRole('group', { name: 'Slides' })
  let scrollLeft = 0
  let scrollWriteListener: (() => void) | undefined

  // jsdom implements neither the pointer-capture API nor scrollTo/scrollBy.
  const setPointerCapture = vi.fn((pointerId: number) => {
    capturedPointers.add(pointerId)
  })
  const releasePointerCapture = vi.fn((pointerId: number) => {
    capturedPointers.delete(pointerId)
  })
  track.setPointerCapture = setPointerCapture
  track.hasPointerCapture = (pointerId: number) => capturedPointers.has(pointerId)
  track.releasePointerCapture = releasePointerCapture

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
    // Clamped, as every browser clamps it — the component relies on that rather
    // than bounding the drag itself, so the stub has to model it.
    set: (next: number) => {
      const maxScroll = Math.max(geometry.scrollWidth - geometry.clientWidth, 0)
      scrollLeft = Math.min(Math.max(next, 0), maxScroll)
      scrollWriteListener?.()
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
    setPointerCapture,
    releasePointerCapture,
    /** Observe every direct write to scrollLeft, for asserting ordering. */
    onScrollWrite: (listener: () => void) => {
      scrollWriteListener = listener
    },
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

function carouselRoot() {
  const root = document.querySelector('.Carousel')
  if (!root) throw new Error('Carousel root not found')
  return root
}

// ---------------------------------------------------------------------------
// Pointer helpers
//
// Default to a primary mouse button and pointer 1, so a test only states the
// part of the gesture it cares about.
// ---------------------------------------------------------------------------

type PointerInit = {
  readonly clientX: number
  readonly pointerType?: string
  /** Which button triggered the event. */
  readonly button?: number
  /** Which buttons are still held — 0 means the press is over. */
  readonly buttons?: number
  readonly pointerId?: number
}

const POINTER_DEFAULTS = {
  pointerId: 1,
  pointerType: 'mouse',
  button: 0,
  buttons: 1,
  isPrimary: true,
}

function pointerDown(target: Element, init: PointerInit) {
  fireEvent.pointerDown(target, { ...POINTER_DEFAULTS, ...init })
}

function pointerMove(target: Element, init: PointerInit) {
  fireEvent.pointerMove(target, { ...POINTER_DEFAULTS, ...init })
}

function pointerUp(target: Element, init: PointerInit) {
  fireEvent.pointerUp(target, { ...POINTER_DEFAULTS, ...init })
}

/** Press at `from`, move to `to`, release — the whole gesture in one call. */
function dragFrom(target: Element, from: number, to: number, pointerType = 'mouse') {
  pointerDown(target, { clientX: from, pointerType })
  pointerMove(target, { clientX: to, pointerType })
  pointerUp(target, { clientX: to, pointerType })
}

/**
 * A pointer-driven click. `detail` is the click count, which a browser sets to 1
 * for a real click and which Testing Library leaves at 0 — the difference
 * matters, because 0 is how the component recognises a keyboard-triggered click.
 */
function pointerClick(target: Element) {
  const event = createEvent.click(target, { detail: 1 })
  fireEvent(target, event)
  return event
}

/** Enter on a focused link: a click with no pointer behind it. */
function keyboardClick(target: Element) {
  const event = createEvent.click(target, { detail: 0 })
  fireEvent(target, event)
  return event
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

    it('neither observes nor listens when nothing needs measuring', () => {
      renderCarousel({ showArrows: false, showDots: false, dragToScroll: false })
      expect(observers).toHaveLength(0)
    })

    it('renders the plain track where ResizeObserver does not exist', () => {
      // The controls are an enhancement over a track that already scrolls, so
      // their absence is the correct degradation — and it keeps every consumer
      // that renders a carousel in a test from needing this stub.
      vi.unstubAllGlobals()
      expect(() => renderCarousel()).not.toThrow()
      expect(screen.getByRole('group', { name: 'Slides' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull()
    })

    it('still measures for the drag alone, so the grab cursor stays honest', () => {
      renderCarousel({ showArrows: false, showDots: false })
      expect(observers).toHaveLength(1)
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

  describe('drag to scroll', () => {
    describe('the grab affordance', () => {
      it('is offered once there is somewhere to scroll', () => {
        renderCarousel()
        applyGeometry(SIX_OF_THREE)
        triggerResize()
        expect(carouselRoot().getAttribute('data-draggable')).toBe('true')
      })

      it('is withheld while unmeasured', () => {
        renderCarousel()
        expect(carouselRoot().hasAttribute('data-draggable')).toBe(false)
      })

      it('is withheld when a drag would move nothing', () => {
        renderCarousel({}, 3)
        applyGeometry(FITS_EXACTLY)
        triggerResize()
        expect(carouselRoot().hasAttribute('data-draggable')).toBe(false)
      })

      it('is withheld when dragToScroll is off', () => {
        renderCarousel({ dragToScroll: false })
        applyGeometry(SIX_OF_THREE)
        triggerResize()
        expect(carouselRoot().hasAttribute('data-draggable')).toBe(false)
      })
    })

    describe('the gesture', () => {
      it('scrolls by the distance dragged, less the threshold', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 150 })

        // Dragging the content 50px left scrolls 50px right, minus the 6px the
        // threshold absorbs — the content tracks the pointer from where the drag
        // was recognised, so it never jumps as it takes hold.
        expect(track.scrollLeft).toBe(44)
      })

      it('tracks the pointer 1:1 once under way', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 150 })
        pointerMove(track, { clientX: 130 })

        expect(track.scrollLeft).toBe(64)
      })

      it('does nothing one pixel short of the threshold', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 195 })

        expect(track.scrollLeft).toBe(0)
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)
      })

      it('takes hold exactly at the threshold', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 194 })

        expect(carouselRoot().hasAttribute('data-dragging')).toBe(true)
      })

      it('suspends snapping only for the duration of the gesture', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 150 })
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(true)

        pointerUp(track, { clientX: 150 })
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)
      })

      it('captures the pointer so the drag survives leaving the track', () => {
        renderCarousel()
        const { track, setPointerCapture, releasePointerCapture } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 150 })
        expect(setPointerCapture).toHaveBeenCalledWith(1)

        pointerUp(track, { clientX: 150 })
        expect(releasePointerCapture).toHaveBeenCalledWith(1)
      })

      it('settles on the nearest snap position when released', () => {
        renderCarousel()
        const { track, scrollTo } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        // Ends at 114, which is nearest the snap position at 100.
        dragFrom(track, 200, 80)
        expect(scrollTo).toHaveBeenCalledWith({ left: 100 })
      })

      it('suspends snapping before the first scroll and restores it before settling', () => {
        // Both orderings matter and neither is visible from the outside: the
        // suspension has to be in place before any scroll position is written,
        // and lifted before the settle so that scroll can snap and animate.
        renderCarousel()
        const { track, scrollTo, onScrollWrite } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        const draggingDuringWrite: boolean[] = []
        onScrollWrite(() => {
          draggingDuringWrite.push(carouselRoot().hasAttribute('data-dragging'))
        })
        let draggingDuringSettle: boolean | undefined
        scrollTo.mockImplementation(() => {
          draggingDuringSettle = carouselRoot().hasAttribute('data-dragging')
        })

        dragFrom(track, 200, 100)

        expect(draggingDuringWrite.length).toBeGreaterThan(0)
        expect(draggingDuringWrite.every(Boolean)).toBe(true)
        expect(draggingDuringSettle).toBe(false)
      })

      it('ends the gesture on pointercancel', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 150 })
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(true)

        fireEvent.pointerCancel(track, { ...POINTER_DEFAULTS, clientX: 150 })
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)
      })

      it('is a no-op when dragToScroll is off', () => {
        renderCarousel({ dragToScroll: false })
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 100 })

        expect(track.scrollLeft).toBe(0)
      })
    })

    describe('leaving other input alone', () => {
      it('ignores touch, which already scrolls natively', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200, pointerType: 'touch' })
        pointerMove(track, { clientX: 100, pointerType: 'touch' })

        expect(track.scrollLeft).toBe(0)
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)
      })

      it('ignores a secondary button', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200, button: 2 })
        pointerMove(track, { clientX: 100 })

        expect(track.scrollLeft).toBe(0)
      })

      it('ignores a pointer that is not the one that started the drag', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 100, pointerId: 2 })

        expect(track.scrollLeft).toBe(0)
      })

      it('does not drag on hover after a press ended out of earshot', () => {
        // A sub-threshold release off the track never reaches the track's own
        // pointerup, and a mouse reuses its pointerId — so the session has to be
        // torn down by the first move that reports no button held, or the track
        // would scroll under an unpressed mouse.
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 198 })
        pointerMove(track, { clientX: 500, buttons: 0 })

        expect(track.scrollLeft).toBe(0)
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)

        // And the stale session is gone rather than merely idle.
        pointerMove(track, { clientX: 100 })
        expect(track.scrollLeft).toBe(0)
      })

      it('abandons a live drag when the button is released out of earshot', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 150 })
        pointerMove(track, { clientX: 140, buttons: 0 })

        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)
      })

      it('recovers rather than stalls when a second pointer presses mid-drag', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 150 })

        // A second press adopts the gesture; the orphaned first one must not
        // leave snapping suspended for good.
        pointerDown(track, { clientX: 150, pointerId: 2 })
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)

        pointerUp(track, { clientX: 150, pointerId: 2 })
        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)
      })
    })

    describe('a track with nothing to scroll', () => {
      it('starts no gesture at all', () => {
        renderCarousel({}, 3)
        const { track } = applyGeometry(FITS_EXACTLY)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        pointerMove(track, { clientX: 100 })

        expect(carouselRoot().hasAttribute('data-dragging')).toBe(false)
      })

      it('leaves clicks on slide content alone', () => {
        // The failure this guards against: a press that wanders 6px on a track
        // that cannot move would otherwise swallow the click, which on a track
        // of linked cards reads as a broken link.
        const onClick = vi.fn()
        render(
          <Carousel>
            <a href="#one" onClick={onClick}>
              Slide one
            </a>
            <a href="#two">Slide two</a>
            <a href="#three">Slide three</a>
          </Carousel>,
        )
        const { track } = applyGeometry(FITS_EXACTLY)
        triggerResize()
        const link = screen.getByRole('link', { name: 'Slide one' })

        dragFrom(track, 200, 100)
        const click = pointerClick(link)

        expect(onClick).toHaveBeenCalledOnce()
        expect(click.defaultPrevented).toBe(false)
      })
    })

    describe('native drag', () => {
      it('is suppressed while a press is in progress', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        pointerDown(track, { clientX: 200 })
        const dragStart = createEvent.dragStart(track)
        fireEvent(track, dragStart)

        expect(dragStart.defaultPrevented).toBe(true)
      })

      it('is left alone otherwise', () => {
        renderCarousel()
        const { track } = applyGeometry(SIX_OF_THREE)
        triggerResize()

        const dragStart = createEvent.dragStart(track)
        fireEvent(track, dragStart)

        expect(dragStart.defaultPrevented).toBe(false)
      })
    })

    // The reason the threshold exists: slides are full of links, and a press on
    // one has to stay a click.
    describe('clicks on slide content', () => {
      function renderWithLink() {
        const onClick = vi.fn()
        render(
          <Carousel>
            <a href="#one" onClick={onClick}>
              Slide one
            </a>
            <a href="#two">Slide two</a>
            <a href="#three">Slide three</a>
            <a href="#four">Slide four</a>
          </Carousel>,
        )
        const geometry = applyGeometry(SIX_OF_THREE)
        triggerResize()
        return { onClick, link: screen.getByRole('link', { name: 'Slide one' }), ...geometry }
      }

      it('follows the link when the pointer barely moved', () => {
        const { onClick, link, track } = renderWithLink()

        dragFrom(track, 200, 198)
        const click = pointerClick(link)

        expect(onClick).toHaveBeenCalledOnce()
        expect(click.defaultPrevented).toBe(false)
      })

      it('does not follow the link when the press became a drag', () => {
        const { onClick, link, track } = renderWithLink()

        dragFrom(track, 200, 100)
        const click = pointerClick(link)

        expect(onClick).not.toHaveBeenCalled()
        expect(click.defaultPrevented).toBe(true)
      })

      it('swallows only the click belonging to that drag', () => {
        const { onClick, link, track } = renderWithLink()

        dragFrom(track, 200, 100)
        pointerClick(link)
        expect(onClick).not.toHaveBeenCalled()

        dragFrom(track, 100, 99)
        pointerClick(link)
        expect(onClick).toHaveBeenCalledOnce()
      })

      it('never swallows a keyboard-triggered click', () => {
        // A drag released outside the window produces no click, leaving the flag
        // set. Pressing Enter on a focused link must not be what clears it.
        const { onClick, link, track } = renderWithLink()

        dragFrom(track, 200, 100)
        const click = keyboardClick(link)

        expect(onClick).toHaveBeenCalledOnce()
        expect(click.defaultPrevented).toBe(false)
      })

      it('does not carry a swallowed click over to the next press', () => {
        // A drag that ends outside the track produces no click at all, so the
        // flag has to be cleared by the next press rather than by a click.
        const { onClick, link, track } = renderWithLink()

        dragFrom(track, 200, 100)
        pointerDown(track, { clientX: 50 })
        pointerUp(track, { clientX: 50 })
        pointerClick(link)

        expect(onClick).toHaveBeenCalledOnce()
      })
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
