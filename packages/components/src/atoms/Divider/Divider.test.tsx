// @vitest-environment jsdom
//
// Smoke tests for the Divider atom (QL-27).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Divider } from './Divider'

afterEach(cleanup)

describe('Divider', () => {
  it('renders an <hr> element', () => {
    render(<Divider data-testid="d" />)
    expect(screen.getByTestId('d').tagName).toBe('HR')
  })

  it('defaults to horizontal orientation', () => {
    render(<Divider data-testid="d" />)
    const el = screen.getByTestId('d')
    expect(el.getAttribute('data-orientation')).toBe('horizontal')
    expect(el.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('sets vertical orientation', () => {
    render(<Divider data-testid="d" orientation="vertical" />)
    const el = screen.getByTestId('d')
    expect(el.getAttribute('data-orientation')).toBe('vertical')
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('forwards additional class names', () => {
    render(<Divider data-testid="d" className="custom" />)
    expect(screen.getByTestId('d').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(<Divider data-testid="d" aria-label="section separator" />)
    expect(screen.getByTestId('d').getAttribute('aria-label')).toBe('section separator')
  })
})
