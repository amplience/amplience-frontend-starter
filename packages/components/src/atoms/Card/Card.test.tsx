// @vitest-environment jsdom
//
// Smoke tests for the Card atom (QL-28).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Card } from './Card'

afterEach(cleanup)

describe('Card', () => {
  it('renders a <div> element', () => {
    render(<Card data-testid="c">content</Card>)
    expect(screen.getByTestId('c').tagName).toBe('DIV')
  })

  it('renders children', () => {
    render(<Card>hello</Card>)
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('defaults to elevation="raised"', () => {
    render(<Card data-testid="c">x</Card>)
    expect(screen.getByTestId('c').getAttribute('data-elevation')).toBe('raised')
  })

  it('defaults to padding="md"', () => {
    render(<Card data-testid="c">x</Card>)
    expect(screen.getByTestId('c').getAttribute('data-padding')).toBe('md')
  })

  it('defaults to color="white"', () => {
    render(<Card data-testid="c">x</Card>)
    expect(screen.getByTestId('c').getAttribute('data-color')).toBe('white')
  })

  it('does not set data-interactive by default', () => {
    render(<Card data-testid="c">x</Card>)
    expect(screen.getByTestId('c').getAttribute('data-interactive')).toBeNull()
  })

  it('forwards elevation as data-elevation attribute', () => {
    render(
      <Card data-testid="c" elevation="bordered">
        x
      </Card>,
    )
    expect(screen.getByTestId('c').getAttribute('data-elevation')).toBe('bordered')
  })

  it('forwards padding as data-padding attribute', () => {
    render(
      <Card data-testid="c" padding="lg">
        x
      </Card>,
    )
    expect(screen.getByTestId('c').getAttribute('data-padding')).toBe('lg')
  })

  it('forwards color as data-color attribute', () => {
    render(
      <Card data-testid="c" color="primary">
        x
      </Card>,
    )
    expect(screen.getByTestId('c').getAttribute('data-color')).toBe('primary')
  })

  it('sets data-interactive="true" when interactive prop is set', () => {
    render(
      <Card data-testid="c" interactive>
        x
      </Card>,
    )
    expect(screen.getByTestId('c').getAttribute('data-interactive')).toBe('true')
  })

  it('forwards additional class names', () => {
    render(
      <Card data-testid="c" className="custom">
        x
      </Card>,
    )
    expect(screen.getByTestId('c').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(
      <Card data-testid="c" aria-label="product card">
        x
      </Card>,
    )
    expect(screen.getByTestId('c').getAttribute('aria-label')).toBe('product card')
  })
})
