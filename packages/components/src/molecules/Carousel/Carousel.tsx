'use client'

import clsx from 'clsx'
import { Children, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'

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
  label = 'Carousel',
  className,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const trackId = `carousel-track-${useId()}`
  const [state, setState] = useState<ScrollState>(INITIAL_STATE)

  // Controls are the only reason to measure anything. With both off, the
  // component is an inert wrapper around a CSS scroll container.
  const hasControls = showArrows || showDots

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
    const scrollLeft = track.scrollLeft

    let activeIndex = 0
    let closestDelta = Number.POSITIVE_INFINITY
    positions.forEach((position, index) => {
      const delta = Math.abs(position - scrollLeft)
      if (delta < closestDelta) {
        closestDelta = delta
        activeIndex = index
      }
    })

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
    if (!track || !hasControls) return

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
  }, [measure, hasControls, slides.length])

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
      className={clsx('Carousel', styles.root, className)}
      // role="group" rather than a region landmark: a carousel is a widget
      // within a page section, not a section of the page (WAI-ARIA APG).
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      data-scrollbar={showScrollbar ? 'true' : 'false'}
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
          onScroll={hasControls ? measure : undefined}
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
