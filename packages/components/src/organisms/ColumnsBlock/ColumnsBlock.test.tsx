// @vitest-environment jsdom
//
// Smoke tests for the ColumnsBlock molecule (QL-30).
//
// NOTE: ColumnsBlock renders a plain <section> without an accessible name,
// so it carries no ARIA landmark role (WAI-ARIA §4.3.4). Tests query the
// section directly rather than via `getByRole('region')`.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ColumnsBlock } from './ColumnsBlock'

afterEach(cleanup)

describe('ColumnsBlock', () => {
  describe('structure', () => {
    it('renders a <section> element', () => {
      const { container } = render(<ColumnsBlock />)
      expect(container.querySelector('section')?.tagName).toBe('SECTION')
    })

    it('renders children', () => {
      render(
        <ColumnsBlock>
          <div data-testid="col-a">A</div>
          <div data-testid="col-b">B</div>
        </ColumnsBlock>,
      )
      expect(screen.getByTestId('col-a')).toBeTruthy()
      expect(screen.getByTestId('col-b')).toBeTruthy()
    })

    it('renders with no children', () => {
      const { container } = render(<ColumnsBlock />)
      expect(container.querySelector('section')).toBeTruthy()
    })

    it('forwards additional class names', () => {
      const { container } = render(<ColumnsBlock className="custom" />)
      expect(container.querySelector('section')?.className).toContain('custom')
    })
  })

  describe('data attributes', () => {
    it('does not set data-background-color when omitted', () => {
      const { container } = render(<ColumnsBlock />)
      expect(container.querySelector('section')?.getAttribute('data-background-color')).toBeNull()
    })

    it('sets data-background-color when provided', () => {
      const { container } = render(<ColumnsBlock backgroundColor="primary" />)
      expect(container.querySelector('section')?.getAttribute('data-background-color')).toBe(
        'primary',
      )
    })
  })

  describe('CSS custom properties', () => {
    it('sets --columns-block-gap when gap is provided', () => {
      const { container } = render(<ColumnsBlock gap={32} />)
      const style = container.querySelector('section')?.getAttribute('style') ?? ''
      expect(style).toContain('--columns-block-gap: 32px')
    })

    it('does not set style when gap is omitted', () => {
      const { container } = render(<ColumnsBlock />)
      expect(container.querySelector('section')?.getAttribute('style')).toBeNull()
    })
  })
})
