// @vitest-environment jsdom
//
// Smoke + prop-plumbing tests for the HeaderBlock organism and its rows.
// Both are presentational: they render a landmark and hand their styling
// decisions to CSS via data attributes, so what's worth pinning is the
// attributes brands select on — those are the component's public contract
// with a brand stylesheet, and a rename here breaks themes silently.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HeaderBlock } from './HeaderBlock'
import { HeaderRow } from './HeaderRow'

afterEach(cleanup)

describe('HeaderBlock', () => {
  it('renders a banner landmark around its children', () => {
    render(
      <HeaderBlock>
        <span>nav</span>
      </HeaderBlock>,
    )
    expect(screen.getByRole('banner').textContent).toBe('nav')
  })

  it('omits data-sticky entirely when not sticky', () => {
    // `data-sticky="false"` would still match [data-sticky] in CSS, so the
    // attribute has to be absent rather than falsy.
    const { container } = render(<HeaderBlock />)
    expect(container.querySelector('header')?.hasAttribute('data-sticky')).toBe(false)
  })

  it('sets data-sticky when sticky', () => {
    render(<HeaderBlock sticky />)
    expect(screen.getByRole('banner').getAttribute('data-sticky')).toBe('true')
  })

  it('defaults max-width and passes an explicit one through', () => {
    const { container } = render(<HeaderBlock />)
    expect(container.querySelector('header')?.getAttribute('data-max-width')).toBe('default')

    cleanup()
    render(<HeaderBlock maxWidth="wide" />)
    expect(screen.getByRole('banner').getAttribute('data-max-width')).toBe('wide')
  })

  it('applies the caller className alongside the component class', () => {
    render(<HeaderBlock className="SiteHeader" />)
    const el = screen.getByRole('banner')
    expect(el.classList.contains('HeaderBlock')).toBe(true)
    expect(el.classList.contains('SiteHeader')).toBe(true)
  })
})

describe('sticky scroll offset', () => {
  const HEADER_HEIGHT = 63.4
  const offset = () => document.documentElement.style.getPropertyValue('--site-scroll-offset')

  const noop = () => undefined

  /** Fires its callback on observe, the way the real observer does. */
  class ImmediateResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
      this.callback([], this)
    }
    unobserve = noop
    disconnect = noop
  }

  const stubLayout = () => {
    vi.stubGlobal('ResizeObserver', ImmediateResizeObserver)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: HEADER_HEIGHT,
    } as DOMRect)
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty('--site-scroll-offset')
  })

  it('publishes the measured header height, rounded up', () => {
    stubLayout()
    render(<HeaderBlock sticky />)
    // Ceil, not round — half a pixel short would still clip the heading.
    expect(offset()).toBe('64px')
  })

  it('clears the offset on unmount', () => {
    stubLayout()
    const { unmount } = render(<HeaderBlock sticky />)
    unmount()
    expect(offset()).toBe('')
  })

  it('publishes nothing for a static header', () => {
    stubLayout()
    render(<HeaderBlock />)
    expect(offset()).toBe('')
  })
})

describe('HeaderRow', () => {
  it('renders its children inside the row', () => {
    const { container } = render(
      <HeaderRow>
        <span>logo</span>
      </HeaderRow>,
    )
    expect(container.textContent).toBe('logo')
  })

  it('leaves data-color unset when no background token is given', () => {
    // An unset row inherits the block's palette; emitting an empty data-color
    // would match [data-color] and override it.
    const { container } = render(<HeaderRow />)
    expect(container.querySelector('.HeaderRow')?.hasAttribute('data-color')).toBe(false)
  })

  it('sets data-color from the background token', () => {
    const { container } = render(<HeaderRow backgroundColor="dark" />)
    expect(container.querySelector('.HeaderRow')?.getAttribute('data-color')).toBe('dark')
  })

  it('constrains only the inner container, not the row itself', () => {
    // The row spans the viewport so its background bleeds edge to edge; the
    // max-width applies to the Container inside it.
    const { container } = render(<HeaderRow maxWidth="narrow" />)
    const row = container.querySelector('.HeaderRow')
    expect(row?.hasAttribute('data-max-width')).toBe(false)
    expect(row?.querySelector('.Container')).not.toBeNull()
  })
})
