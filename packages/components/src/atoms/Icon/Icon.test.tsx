// @vitest-environment jsdom
//
// Smoke tests for the Icon atom (QL-26).
// lucide-react is used as-is — no mock needed since the tests only assert on
// the wrapper's behaviour (a11y, size, colour, className), not Lucide internals.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Icon } from './Icon'

afterEach(cleanup)

// ---------------------------------------------------------------------------
// A11y
// ---------------------------------------------------------------------------

describe('Icon — a11y', () => {
  it('is aria-hidden when no label is supplied (decorative)', () => {
    const { container } = render(<Icon name="search" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.getAttribute('role')).toBeNull()
    expect(wrapper.getAttribute('aria-label')).toBeNull()
  })

  it('has role="img" and aria-label when a label is supplied', () => {
    const { container } = render(<Icon name="search" label="Search" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('img')
    expect(wrapper.getAttribute('aria-label')).toBe('Search')
    expect(wrapper.getAttribute('aria-hidden')).toBeNull()
  })

  it('is findable by its label when labelled', () => {
    render(<Icon name="search" label="Search" />)
    expect(screen.getByRole('img', { name: 'Search' })).toBeTruthy()
  })

  it('marks the inner SVG aria-hidden regardless of labelling', () => {
    const { container } = render(<Icon name="search" label="Labelled" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('Icon — rendering', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Icon name="search" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders an SVG for every registered icon name', () => {
    const { container } = render(<Icon name="shopping-cart" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------

describe('Icon — size', () => {
  it('defaults to "1em" so it scales with surrounding text', () => {
    const { container } = render(<Icon name="search" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('1em')
  })

  it('forwards an explicit numeric size', () => {
    const { container } = render(<Icon name="search" size={20} />)
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('20')
  })

  it('forwards an explicit string size', () => {
    const { container } = render(<Icon name="search" size="1.5rem" />)
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('1.5rem')
  })
})

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

describe('Icon — color', () => {
  it('does not set data-color when color is omitted', () => {
    const { container } = render(<Icon name="search" />)
    expect((container.firstElementChild as HTMLElement).getAttribute('data-color')).toBeNull()
  })

  it.each(['primary', 'secondary', 'black', 'white'] as const)(
    'sets data-color="%s" on the wrapper',
    (color) => {
      const { container } = render(<Icon name="search" color={color} />)
      expect((container.firstElementChild as HTMLElement).getAttribute('data-color')).toBe(color)
    },
  )
})

// ---------------------------------------------------------------------------
// className
// ---------------------------------------------------------------------------

describe('Icon — className', () => {
  it('forwards additional class names to the wrapper', () => {
    const { container } = render(<Icon name="search" className="custom" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('custom')
  })
})
