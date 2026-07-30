'use client'

import clsx from 'clsx'
import {
  Children,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DOMAttributes,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

import { IconButton } from '../IconButton/IconButton'
import styles from './Carousel.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How far a single arrow press advances the track. */
export type CarouselScrollStep = 'slide' | 'page'

export type CarouselProps = {
  children?: ReactNode
  /**
   * Slides visible below 769px. Defaults to 1.
   *
   * Fractional values are supported and are the idiomatic way to hint that
   * the track scrolls: 1.2 shows one full slide plus a sliver of the next.
   */
  slidesMobile?: number
  /** Slides visible from 769px. Defaults to 2. */
  slidesTablet?: number
  /** Slides visible from 992px. Defaults to 3. */
  slidesDesktop?: number
  /**
   * Gap between slides, in px.
   * Defaults to the --gap token (16px at the base scale).
   */
  gap?: number
  /**
   * Show the previous/next arrows. Defaults to true.
   *
   * Arrows are omitted entirely when the track doesn't overflow, so a
   * carousel that happens to hold one slide doesn't grow dead controls.
   */
  showArrows?: boolean
  /**
   * Show the pagination dots. Defaults to true.
   *
   * As with the arrows, dots only appear once there is more than one position
   * to scroll to.
   */
  showDots?: boolean
  /**
   * Show the horizontal scrollbar beneath the track. Defaults to false.
   *
   * Worth turning on for a dense, arrow-free track where the scrollbar is the
   * intended affordance; the styled treatment lives in the CSS module either
   * way.
   */
  showScrollbar?: boolean
  /**
   * How far one arrow press moves the track. Defaults to 'slide'.
   *
   *   'slide' — advance to the next snap position, one slide at a time.
   *   'page'  — advance by a full track width, as a paged listing would.
   */
  scrollStep?: CarouselScrollStep
  /**
   * Let a mouse drag the slides to scroll. Defaults to true.
   *
   * Touch and pen keep their native panning — see usePointerDragScroll. Clicks
   * on links inside slides still work; a drag is distinguished from a click by
   * distance. Selecting text inside a slide by dragging across it does not
   * survive, which is the inherent cost of the gesture.
   *
   * Turn this off for slides whose content wants the drag for itself (a map, a
   * range input, a colour picker), or where text selection matters more.
   *
   * Note for WCAG 2.5.7 (Dragging Movements): the arrows and dots are the
   * single-pointer alternative to the drag, so leave at least one of them on.
   */
  dragToScroll?: boolean
  /**
   * Accessible name for the carousel, announced alongside the "carousel" role
   * description. Defaults to 'Carousel' — supply something specific
   * ('Featured products') whenever the surrounding content gives you one, as
   * a page with several generically-named carousels is hard to navigate.
   */
  label?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Snap-position measurement
// ---------------------------------------------------------------------------

/**
 * Sub-pixel tolerance, in px, for every scroll-position comparison.
 *
 * Browsers report `scrollLeft`, `scrollWidth` and `clientWidth` as fractional
 * values under fractional slide widths and non-integer zoom, so a track
 * scrolled fully to one end can report a remainder of a fraction of a pixel.
 * Comparing exactly would leave an arrow stuck enabled at the end of the
 * track, which is the more visible failure of the two.
 */
const EPSILON = 2

/**
 * The scroll offsets this track can settle at, in ascending order.
 *
 * Every control derives from this one list, which is what keeps the arrows and
 * the dots from disagreeing. Three things make it more than just "the offset of
 * each slide":
 *
 *   1. Slides beyond the end are dropped. With 6 slides and 3 visible, only
 *      slides 0–3 can be brought to the leading edge; reaching slide 4 would
 *      mean scrolling past the end of the track. So there are four positions,
 *      not six, and four dots.
 *   2. The end of the track is appended when the last in-range slide offset
 *      falls short of it. That happens whenever the slides don't divide the
 *      track evenly — the fractional "peek" case — and scroll-snap clamps snap
 *      positions into the scrollable range, so the end genuinely is a position
 *      the track settles at. Without this the final sliver of content would be
 *      reachable but have no dot, and the next arrow would stay enabled after
 *      the last dot lit up.
 *   3. Offsets that don't advance are skipped, so a slide the browser hasn't
 *      laid out (a `display: none` child reports an offset of 0) can't inject a
 *      duplicate position.
 *
 * Offsets are measured relative to the first slide rather than to the track, so
 * any track padding cancels out.
 *
 * Assumes a left-to-right writing mode: in RTL, `offsetLeft` descends across the
 * slides and `scrollLeft` is negative, and this returns a single position. The
 * track still scrolls and snaps — that's all CSS — but the arrows and dots
 * won't appear. Wiring up RTL is deferred rather than half-done.
 */
function snapPositions(track: HTMLElement): number[] {
  const slides = Array.from(track.children) as HTMLElement[]
  const first = slides[0]
  if (!first) return [0]

  const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 0)
  const origin = first.offsetLeft
  const positions: number[] = []

  for (const slide of slides) {
    const offset = slide.offsetLeft - origin
    if (offset > maxScroll + EPSILON) break
    const previous = positions[positions.length - 1]
    if (previous !== undefined && offset <= previous + EPSILON) continue
    positions.push(offset)
  }

  if (positions.length === 0) positions.push(0)

  const last = positions[positions.length - 1]
  if (last !== undefined && maxScroll - last > EPSILON) positions.push(maxScroll)

  return positions
}

/** Index of the snap position closest to `scrollLeft`. Ties go to the earlier one. */
function nearestIndex(positions: readonly number[], scrollLeft: number): number {
  let index = 0
  let closestDelta = Number.POSITIVE_INFINITY
  positions.forEach((position, candidate) => {
    const delta = Math.abs(position - scrollLeft)
    if (delta < closestDelta) {
      closestDelta = delta
      index = candidate
    }
  })
  return index
}

// ---------------------------------------------------------------------------
// Drag to scroll
// ---------------------------------------------------------------------------

/**
 * How far the pointer must travel, in px, before a press counts as a drag
 * rather than a click. Browsers use a similar figure to decide when a mousedown
 * becomes a native drag, and it comfortably absorbs the shake of a normal click.
 */
const DRAG_THRESHOLD = 6

type DragSession = {
  readonly pointerId: number
  /**
   * Pointer x the movement is measured from. Nudged by DRAG_THRESHOLD when the
   * drag is recognised, so the content never jumps by the threshold distance.
   */
  startX: number
  readonly startScroll: number
  /** Whether the pointer has passed DRAG_THRESHOLD and this is now a drag. */
  active: boolean
}

/** The handlers the hook contributes to the track, or nothing when disabled. */
type DragHandlers = Pick<
  DOMAttributes<HTMLDivElement>,
  | 'onPointerDown'
  | 'onPointerMove'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onClickCapture'
  | 'onDragStart'
>

/**
 * Click-and-drag scrolling for a mouse, layered over the native scrolling the
 * track already has.
 *
 * Three properties make it safe to add to a track full of links:
 *
 *   1. **Mouse only.** Touch already gets native, momentum, GPU-composited
 *      scrolling, and pen gets the same native panning in Chromium; replacing
 *      either with JavaScript is strictly worse, and the two would fight. So the
 *      gesture is gated on `pointerType === 'mouse'` and `touch-action` is left
 *      alone. A trackpad click-drag reports as a mouse, and a finger on a
 *      touchscreen laptop reports as touch, so hybrid devices get the right one
 *      of the two per gesture.
 *   2. **Nothing happens below the threshold.** No `preventDefault` on
 *      pointerdown (which would break focus), and no scrolling until the pointer
 *      has travelled DRAG_THRESHOLD px. Short of that the gesture is an ordinary
 *      click, so links and buttons inside slides behave exactly as they would
 *      without this hook. No session starts at all on a track with nothing to
 *      scroll, so a click there can never be mistaken for a drag.
 *   3. **A real drag swallows its own click.** Releasing after a drag still
 *      produces a click event, which would follow whatever link happens to be
 *      under the pointer. It's cancelled in the capture phase instead — before
 *      the native event can descend to the link, so both navigation and any
 *      descendant onClick are covered. The flag is cleared on the next press, so
 *      a drag that ends outside the track (and therefore produces no click)
 *      can't eat a later one; keyboard-synthesised clicks are exempt outright.
 *
 * The `data-dragging` attribute the hook sets on the root is not cosmetic: it's
 * what suspends `scroll-snap-type` and `scroll-behavior` in the CSS module.
 * Mandatory snap would re-snap after every scroll position we write, and smooth
 * behaviour would animate each one — either makes the track fight the pointer.
 * The attribute is written directly to the DOM rather than held in state so it
 * lands before the first scroll write, without waiting on a render.
 *
 * On release the track is scrolled to the nearest snap position explicitly,
 * using the same code path as the arrows and dots, rather than relying on the
 * browser to re-snap when `scroll-snap-type` returns.
 *
 * A pointer press can end without a pointerup the track ever hears about — a
 * sub-threshold release off the track, or a release outside the window. Because
 * a mouse keeps the same pointerId across gestures, a session that outlived its
 * press would resume on the next hover and scroll the track with no button held,
 * so every move re-checks that a button is still down.
 *
 * WCAG 2.5.7 (Dragging Movements) asks for a single-pointer alternative to any
 * drag gesture. The arrows and dots are that alternative — a reason to leave at
 * least one of them enabled.
 */
function usePointerDragScroll(
  rootRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
): DragHandlers {
  const session = useRef<DragSession | null>(null)
  const swallowNextClick = useRef(false)

  const setDragging = useCallback(
    (dragging: boolean) => {
      const root = rootRef.current
      if (!root) return
      if (dragging) root.setAttribute('data-dragging', '')
      else root.removeAttribute('data-dragging')
    },
    [rootRef],
  )

  /**
   * Tear a session down, restoring everything an active drag had suspended.
   * Safe to call for a session that never crossed the threshold.
   */
  const releaseSession = useCallback(
    (current: DragSession) => {
      session.current = null
      if (!current.active) return
      const track = trackRef.current
      if (track?.hasPointerCapture(current.pointerId)) {
        track.releasePointerCapture(current.pointerId)
      }
      setDragging(false)
    },
    [trackRef, setDragging],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Any new press means the previous gesture is over, whether or not its
      // click ever arrived.
      swallowNextClick.current = false
      // A second press while one is live would orphan the first, leaving snap
      // suspended with nothing able to restore it. Recover rather than refuse.
      const stale = session.current
      if (stale) releaseSession(stale)

      // Mouse only (see the hook docstring), primary button, primary pointer.
      if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return

      const track = trackRef.current
      if (!track) return
      // Nothing to scroll means nothing to drag. Starting a session anyway would
      // suspend snap and swallow the click for a gesture that moves nothing —
      // and on a track of linked cards that reads as a broken link.
      if (track.scrollWidth - track.clientWidth <= EPSILON) return

      session.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScroll: track.scrollLeft,
        active: false,
      }
    },
    [trackRef, releaseSession],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = session.current
      const track = trackRef.current
      if (current?.pointerId !== event.pointerId || !track) return

      // The button came up somewhere we never heard about. See the hook
      // docstring — a stale session would resume on the next hover.
      if (event.buttons === 0) {
        releaseSession(current)
        return
      }

      if (!current.active) {
        const travelled = event.clientX - current.startX
        if (Math.abs(travelled) < DRAG_THRESHOLD) return
        current.active = true
        // Absorb the threshold distance instead of jumping by it: from here the
        // content tracks the pointer 1:1, measured from where the drag was
        // recognised rather than from where the button went down.
        current.startX += Math.sign(travelled) * DRAG_THRESHOLD
        // Selection begins within the first pixel or two, well before
        // `user-select: none` arrives with the attribute below, and lifting it
        // later won't clear what's already highlighted.
        window.getSelection()?.removeAllRanges()
        // Capture so the drag survives the pointer leaving the track — moving
        // vertically out of a short carousel mid-gesture is easy to do.
        track.setPointerCapture(current.pointerId)
        setDragging(true)
      }

      track.scrollLeft = current.startScroll - (event.clientX - current.startX)
    },
    [trackRef, setDragging, releaseSession],
  )

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = session.current
      if (current?.pointerId !== event.pointerId) return
      const wasDragging = current.active
      // Restores snap and smooth scrolling before the settle below.
      releaseSession(current)
      if (!wasDragging) return

      swallowNextClick.current = true
      const track = trackRef.current
      if (!track) return
      const positions = snapPositions(track)
      const target = positions[nearestIndex(positions, track.scrollLeft)]
      if (target !== undefined) track.scrollTo({ left: target })
    },
    [trackRef, releaseSession],
  )

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!swallowNextClick.current) return
    // A click with no pointer behind it (Enter on a focused link) can't be the
    // tail of a drag, and must never be swallowed by a flag left over from one.
    if (event.detail === 0) return
    swallowNextClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const onDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    // Links and images start a native HTML5 drag on their own, which would
    // hijack the gesture and show a drag ghost. Suppressed for the whole press,
    // not just past the threshold, because browsers begin the native drag at a
    // smaller distance than DRAG_THRESHOLD.
    if (session.current) event.preventDefault()
  }, [])

  if (!enabled) return {}

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onClickCapture,
    onDragStart,
  }
}

/** Everything the client island derives from the scroll position. */
type ScrollState = {
  /** Index into the snap positions, not into the slides. */
  readonly activeIndex: number
  /** How many positions the track can settle at. */
  readonly snapCount: number
}

const INITIAL_STATE: ScrollState = {
  activeIndex: 0,
  // 0 means "not yet measured", which is distinct from 1 ("measured, and
  // there's nowhere to scroll"). The dots row uses that distinction to
  // reserve its height before the first measurement without leaving an empty
  // row behind on a carousel that turns out not to scroll.
  snapCount: 0,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Carousel molecule — a horizontally scrolling track of slides.
 *
 * The scrolling itself is pure CSS: a flex track with `overflow-x: auto` and
 * `scroll-snap-type: x mandatory`, with each slide a snap point. Touch,
 * trackpad, scrollbar drag and keyboard arrow keys therefore all work before
 * any JavaScript runs, and continue to work if it never does.
 *
 * The client island exists only to render controls CSS cannot: prev/next
 * arrows and pagination dots. Critically, it does not own the scroll position
 * — the DOM does. The island reads the position on scroll and on resize, and
 * derives which controls should be enabled and which dot is current. Nothing
 * is written back except in direct response to a press.
 *
 * That direction of data flow is the substantive difference from the earlier
 * Quadratic v1 carousel, where React held a `currentSlide` index and scrolled
 * the container to match. Two sources of truth for one position needs a
 * programmatic-scroll guard flag, a debounce, and a reverse index calculation
 * to stay in sync, and drifts anyway. Reading a single source of truth needs
 * none of those.
 *
 * Deliberately absent:
 *   - Autoplay. It hurts comprehension, needs hover/focus/reduced-motion
 *     escape hatches to be acceptable, and no content brief asks for it.
 *   - Infinite loop. Native scroll-snap has no wraparound; faking it means
 *     cloning slides and teleporting the scroll position, which fights the
 *     "DOM owns the position" property above.
 *   - Right-to-left support — see snapPositions above.
 *
 * Layout is the parent's concern: no Container, no section wrapper, no
 * background band. The phase-2 CarouselBlock organism adds those, the way
 * GridBlock and ColumnsBlock do for their tracks.
 *
 * All visual theming reads from --carousel-* CSS variables; brands override
 * under [data-brand] without touching this file.
 *
 * Usage:
 *   <Carousel slidesMobile={1} slidesTablet={2} slidesDesktop={4}>
 *     <MediaCard … /> <MediaCard … />
 *   </Carousel>
 *
 *   // Peek affordance on mobile, scrollbar instead of arrows
 *   <Carousel slidesMobile={1.2} showArrows={false} showScrollbar>
 *     …
 *   </Carousel>
 */
export function Carousel({
  children,
  slidesMobile = 1,
  slidesTablet = 2,
  slidesDesktop = 3,
  gap,
  showArrows = true,
  showDots = true,
  showScrollbar = false,
  scrollStep = 'slide',
  dragToScroll = true,
  label = 'Carousel',
  className,
}: CarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const trackId = `carousel-track-${useId()}`
  const [state, setState] = useState<ScrollState>(INITIAL_STATE)

  const dragHandlers = usePointerDragScroll(rootRef, trackRef, dragToScroll)

  // Measuring is what tells us whether there is anywhere to scroll, which every
  // affordance depends on — the arrows and dots for whether to render at all,
  // the drag for whether to offer a grab cursor. With all three off nothing
  // needs the answer, so nothing is measured.
  const measures = showArrows || showDots || dragToScroll

  // Children are flattened to an array so each one can be wrapped in a labelled
  // slide. toArray also drops the null/false entries a conditional
  // (`{inStock && <Card/>}`) leaves behind, so this length matches the number of
  // elements in the track exactly — which is what makes it a sound dependency
  // for the observer effect below.
  const slides = Children.toArray(children)

  /** Read the scroll position and derive control state from it. */
  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const positions = snapPositions(track)
    const activeIndex = nearestIndex(positions, track.scrollLeft)

    // Scrolling fires continuously and most events change nothing we render.
    // Bailing out on an unchanged result avoids a re-render per scroll event.
    setState((prev) =>
      prev.activeIndex === activeIndex && prev.snapCount === positions.length
        ? prev
        : { activeIndex, snapCount: positions.length },
    )
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track || !measures) return

    // ResizeObserver fires once on observe, which covers the initial
    // measurement, and again on any size change — so there's no window resize
    // listener and no breakpoint bookkeeping in JavaScript. The slides are
    // observed as well as the track: an image finishing loading changes the
    // track's scrollWidth without changing the track's own box, and the
    // track's observer alone would miss it.
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    for (const slide of Array.from(track.children)) observer.observe(slide)

    return () => observer.disconnect()
  }, [measure, measures, slides.length])

  /**
   * Scroll to a snap position by index.
   *
   * `behavior` is deliberately omitted so the browser falls back to the
   * computed `scroll-behavior`, which the CSS module switches to `auto` under
   * prefers-reduced-motion. Passing 'smooth' here would override that and
   * animate for users who asked us not to.
   */
  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current
    if (!track) return
    const target = snapPositions(track)[index]
    if (target === undefined) return
    track.scrollTo({ left: target })
  }, [])

  /** Advance the track one step in `direction` (1 = next, -1 = previous). */
  const step = useCallback(
    (direction: 1 | -1) => {
      const track = trackRef.current
      if (!track) return

      if (scrollStep === 'page') {
        // Land roughly a viewport away and let scroll-snap settle it onto the
        // nearest snap position.
        track.scrollBy({ left: direction * track.clientWidth })
        return
      }

      const positions = snapPositions(track)
      const current = track.scrollLeft
      const target =
        direction === 1
          ? positions.find((position) => position > current + EPSILON)
          : positions.filter((position) => position < current - EPSILON).pop()
      if (target === undefined) return
      track.scrollTo({ left: target })
    },
    [scrollStep],
  )

  const cssVars: Record<string, string | number> = {
    '--carousel-slides-mobile': slidesMobile,
    '--carousel-slides-tablet': slidesTablet,
    '--carousel-slides-desktop': slidesDesktop,
  }
  if (gap != null) cssVars['--carousel-gap'] = `${gap}px`

  // One measured condition drives both control sets, so they appear and
  // disappear together and can never contradict each other.
  const scrollable = state.snapCount > 1
  // Before the first measurement we can't know how many dots there are, but we
  // can reserve their row so they don't shift the slides when they arrive.
  const dotsReserved = showDots && state.snapCount === 0

  return (
    <div
      ref={rootRef}
      className={clsx('Carousel', styles.root, className)}
      // role="group" rather than a region landmark: a carousel is a widget
      // within a page section, not a section of the page (WAI-ARIA APG).
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      data-scrollbar={showScrollbar ? 'true' : 'false'}
      // Present only when a drag would actually move something, so the grab
      // cursor never promises a gesture that does nothing. usePointerDragScroll
      // sets data-dragging alongside it, straight to the DOM.
      data-draggable={dragToScroll && scrollable ? 'true' : undefined}
      style={cssVars}
    >
      <div className={styles.viewport}>
        <div
          id={trackId}
          ref={trackRef}
          className={styles.track}
          // A scroll container needs an explicit tabindex to be focusable in
          // Safari, which is what makes arrow-key scrolling work there. The
          // a11y lint rule guards against making decorative containers focus
          // stops; this one is a genuine interactive scroll region, named
          // below so it doesn't announce as an anonymous group.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          role="group"
          aria-label="Slides"
          onScroll={measures ? measure : undefined}
          {...dragHandlers}
        >
          {slides.map((slide, index) => (
            // Each slide is wrapped rather than annotated in place: children
            // arrive as opaque rendered content, and the APG carousel pattern
            // wants every slide to announce its position in the set. The
            // wrapper is also what carries the width and snap alignment, so
            // the track's children are uniform however the CMS composed them.
            <div
              key={index}
              className={styles.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
            >
              {slide}
            </div>
          ))}
        </div>

        {showArrows && scrollable && (
          <>
            <IconButton
              icon="chevron-left"
              label="Previous slide"
              controls={trackId}
              disabled={state.activeIndex === 0}
              onClick={() => step(-1)}
              className={clsx(styles.arrow, styles.arrowPrev)}
            />
            <IconButton
              icon="chevron-right"
              label="Next slide"
              controls={trackId}
              disabled={state.activeIndex >= state.snapCount - 1}
              onClick={() => step(1)}
              className={clsx(styles.arrow, styles.arrowNext)}
            />
          </>
        )}
      </div>

      {dotsReserved && <div className={styles.dots} aria-hidden="true" />}

      {showDots && scrollable && (
        <div className={styles.dots} role="group" aria-label="Choose a slide to show">
          {Array.from({ length: state.snapCount }, (_, index) => (
            <button
              key={index}
              type="button"
              className={styles.dot}
              aria-label={`Go to slide ${index + 1} of ${state.snapCount}`}
              aria-current={index === state.activeIndex ? 'true' : undefined}
              aria-controls={trackId}
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
