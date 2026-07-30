// @vitest-environment jsdom
//
// Smoke tests for the CarouselBlock organism (ADR-0020).
//
// The track's own behaviour is covered exhaustively in Carousel.test.tsx; these
// tests are about the section chrome this component adds and the props it
// forwards. jsdom has no layout, so the carousel measures nothing and renders no
// arrows or dots here — which suits testing the wrapper in isolation.
//
// CSS module classes are empty strings in the test environment and are not
// asserted; `Container` is identified by its own literal class hook.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CarouselBlock } from './CarouselBlock'

afterEach(cleanup)

function slides(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} data-testid={`slide-${index}`}>
      Slide {index + 1}
    </div>
  ))
}

describe('CarouselBlock', () => {
  describe('structure', () => {
    it('renders a <section> element', () => {
      const { container } = render(<CarouselBlock>{slides(3)}</CarouselBlock>)
      expect(container.querySelector('section')?.tagName).toBe('SECTION')
    })

    it('renders its children as slides inside the track', () => {
      render(<CarouselBlock>{slides(3)}</CarouselBlock>)
      const track = screen.getByRole('group', { name: 'Slides' })
      expect(track.contains(screen.getByTestId('slide-0'))).toBe(true)
      expect(screen.getByTestId('slide-2').textContent).toBe('Slide 3')
    })

    it('renders with no children', () => {
      const { container } = render(<CarouselBlock />)
      expect(container.querySelector('.CarouselBlock')).toBeTruthy()
    })

    it('wraps the track in a Container', () => {
      const { container } = render(<CarouselBlock>{slides(3)}</CarouselBlock>)
      expect(container.querySelector('.Container')).toBeTruthy()
    })

    it('forwards additional class names', () => {
      const { container } = render(<CarouselBlock className="custom" />)
      expect(container.querySelector('section')?.className).toContain('custom')
    })
  })

  describe('gutter', () => {
    // The gutter bleed is pure CSS — CarouselBlock.module.css rebinds
    // --carousel-bleed-inline on `.container[data-gutter]` so the track shows
    // through into the gutter rather than being clipped at the content edge.
    // jsdom can't evaluate that, but it can hold the seam the rule hangs off:
    // if Container ever stopped emitting `data-gutter`, or CarouselBlock
    // stopped passing `gutter` through, the bleed would silently disappear with
    // nothing else failing.

    it('marks the Container as guttered so the track can bleed into it', () => {
      const { container } = render(<CarouselBlock gutter>{slides(4)}</CarouselBlock>)
      expect(container.querySelector('.Container')?.hasAttribute('data-gutter')).toBe(true)
    })

    it('leaves the attribute off without a gutter, so there is no bleed', () => {
      const { container } = render(<CarouselBlock>{slides(4)}</CarouselBlock>)
      expect(container.querySelector('.Container')?.hasAttribute('data-gutter')).toBe(false)
    })
  })

  describe('section header', () => {
    it('renders nothing when omitted', () => {
      render(<CarouselBlock>{slides(2)}</CarouselBlock>)
      expect(screen.queryByRole('heading')).toBeNull()
    })

    it('renders the title, subtitle and description when provided', () => {
      render(
        <CarouselBlock
          sectionHeader={{ title: 'New in', subtitle: 'This week', description: 'Fresh stock.' }}
        >
          {slides(2)}
        </CarouselBlock>,
      )
      expect(screen.getByRole('heading', { level: 2, name: 'New in' })).toBeTruthy()
      expect(screen.getByRole('heading', { level: 3, name: 'This week' })).toBeTruthy()
      expect(screen.getByText('Fresh stock.')).toBeTruthy()
    })
  })

  describe('accessible name', () => {
    it('takes the carousel name from the section header title', () => {
      // Saves asking the author for the same string twice, and stops a page of
      // carousels all announcing as "Carousel".
      render(<CarouselBlock sectionHeader={{ title: 'New in' }}>{slides(2)}</CarouselBlock>)
      expect(screen.getByRole('group', { name: 'New in' })).toBeTruthy()
    })

    it('falls back to the molecule default with no title', () => {
      render(<CarouselBlock>{slides(2)}</CarouselBlock>)
      expect(screen.getByRole('group', { name: 'Carousel' })).toBeTruthy()
    })

    it('falls back when the title is only whitespace', () => {
      render(<CarouselBlock sectionHeader={{ title: '   ' }}>{slides(2)}</CarouselBlock>)
      expect(screen.getByRole('group', { name: 'Carousel' })).toBeTruthy()
    })
  })

  describe('data attributes', () => {
    it('does not set data-background-color when omitted', () => {
      const { container } = render(<CarouselBlock />)
      expect(container.querySelector('section')?.getAttribute('data-background-color')).toBeNull()
    })

    it('sets data-background-color when provided', () => {
      const { container } = render(<CarouselBlock backgroundColor="dark" />)
      expect(container.querySelector('section')?.getAttribute('data-background-color')).toBe('dark')
    })
  })

  describe('forwarding to the carousel', () => {
    it('forwards the slide counts as CSS custom properties', () => {
      const { container } = render(
        <CarouselBlock slidesMobile={1.2} slidesTablet={2} slidesDesktop={4}>
          {slides(4)}
        </CarouselBlock>,
      )
      const style = container.querySelector('.Carousel')?.getAttribute('style') ?? ''
      expect(style).toContain('--carousel-slides-mobile: 1.2')
      expect(style).toContain('--carousel-slides-tablet: 2')
      expect(style).toContain('--carousel-slides-desktop: 4')
    })

    it('forwards the gap', () => {
      const { container } = render(<CarouselBlock gap={32}>{slides(4)}</CarouselBlock>)
      expect(container.querySelector('.Carousel')?.getAttribute('style')).toContain(
        '--carousel-gap: 32px',
      )
    })

    it('forwards the scrollbar toggle', () => {
      const { container } = render(<CarouselBlock showScrollbar>{slides(4)}</CarouselBlock>)
      expect(container.querySelector('.Carousel')?.getAttribute('data-scrollbar')).toBe('true')
    })

    it('leaves the molecule to supply its own defaults', () => {
      // Unset props are omitted rather than passed through as undefined, so the
      // molecule's defaults remain the single definition of an unconfigured
      // carousel.
      const { container } = render(<CarouselBlock>{slides(4)}</CarouselBlock>)
      const style = container.querySelector('.Carousel')?.getAttribute('style') ?? ''
      expect(style).toContain('--carousel-slides-mobile: 1')
      expect(style).toContain('--carousel-slides-tablet: 2')
      expect(style).toContain('--carousel-slides-desktop: 3')
      expect(style).not.toContain('--carousel-gap')
      expect(container.querySelector('.Carousel')?.getAttribute('data-scrollbar')).toBe('false')
    })
  })
})
