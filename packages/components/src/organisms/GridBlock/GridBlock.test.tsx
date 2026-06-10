// @vitest-environment jsdom
//
// Smoke tests for the GridBlock molecule (QL-31).
//
// NOTE: GridBlock renders a plain <section> without an accessible name,
// so it carries no ARIA landmark role (WAI-ARIA §4.3.4). Tests query the
// section directly rather than via `getByRole('region')`.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GridBlock } from './GridBlock'

afterEach(cleanup)

describe('GridBlock', () => {
  describe('structure', () => {
    it('renders a <section> element', () => {
      const { container } = render(<GridBlock />)
      expect(container.querySelector('section')?.tagName).toBe('SECTION')
    })

    it('renders children', () => {
      render(
        <GridBlock>
          <div data-testid="child-a">A</div>
          <div data-testid="child-b">B</div>
        </GridBlock>,
      )
      expect(screen.getByTestId('child-a')).toBeTruthy()
      expect(screen.getByTestId('child-b')).toBeTruthy()
    })

    it('renders with no children', () => {
      const { container } = render(<GridBlock />)
      expect(container.querySelector('section')).toBeTruthy()
    })

    it('forwards additional class names', () => {
      const { container } = render(<GridBlock className="custom" />)
      expect(container.querySelector('section')?.className).toContain('custom')
    })
  })

  describe('data attributes', () => {
    it('defaults to fixed sizing mode', () => {
      const { container } = render(<GridBlock />)
      expect(container.querySelector('section')?.getAttribute('data-sizing-mode')).toBe('fixed')
    })

    it('sets data-sizing-mode to auto when specified', () => {
      const { container } = render(<GridBlock sizingMode="auto" />)
      expect(container.querySelector('section')?.getAttribute('data-sizing-mode')).toBe('auto')
    })

    it('does not set data-background-color when omitted', () => {
      const { container } = render(<GridBlock />)
      expect(container.querySelector('section')?.getAttribute('data-background-color')).toBeNull()
    })

    it('sets data-background-color when provided', () => {
      const { container } = render(<GridBlock backgroundColor="dark" />)
      expect(container.querySelector('section')?.getAttribute('data-background-color')).toBe('dark')
    })
  })

  describe('CSS custom properties', () => {
    it('sets --grid-block-columns-mobile from prop', () => {
      const { container } = render(<GridBlock columnsMobile={2} />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).toContain('--grid-block-columns-mobile: 2')
    })

    it('sets --grid-block-columns-tablet from prop', () => {
      const { container } = render(<GridBlock columnsTablet={3} />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).toContain('--grid-block-columns-tablet: 3')
    })

    it('sets --grid-block-columns-desktop from prop', () => {
      const { container } = render(<GridBlock columnsDesktop={4} />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).toContain('--grid-block-columns-desktop: 4')
    })

    it('sets --grid-block-min-item-width from prop', () => {
      const { container } = render(<GridBlock minItemWidth={300} />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).toContain('--grid-block-min-item-width: 300px')
    })

    it('sets --grid-block-gap from prop', () => {
      const { container } = render(<GridBlock gap={32} />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).toContain('--grid-block-gap: 32px')
    })

    it('does not set --grid-block-gap when gap is omitted', () => {
      const { container } = render(<GridBlock />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).not.toContain('--grid-block-gap:')
    })

    it('applies default column values', () => {
      const { container } = render(<GridBlock />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).toContain('--grid-block-columns-mobile: 1')
      expect(style).toContain('--grid-block-columns-tablet: 2')
      expect(style).toContain('--grid-block-columns-desktop: 3')
    })
  })
})
