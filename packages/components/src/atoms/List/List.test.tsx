// @vitest-environment jsdom
//
// Smoke tests for the List atom (QL-28).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { List } from './List'

afterEach(cleanup)

describe('List', () => {
  it('renders a <ul> element by default', () => {
    render(<List data-testid="l">items</List>)
    expect(screen.getByTestId('l').tagName).toBe('UL')
  })

  it('renders an <ol> element when as="ol"', () => {
    render(
      <List data-testid="l" as="ol">
        items
      </List>,
    )
    expect(screen.getByTestId('l').tagName).toBe('OL')
  })

  it('renders children', () => {
    render(<List>hello</List>)
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('defaults to gap="none"', () => {
    render(<List data-testid="l">x</List>)
    expect(screen.getByTestId('l').getAttribute('data-gap')).toBe('none')
  })

  it('defaults to marker="auto"', () => {
    render(<List data-testid="l">x</List>)
    expect(screen.getByTestId('l').getAttribute('data-marker')).toBe('auto')
  })

  it('forwards gap as data-gap attribute', () => {
    render(
      <List data-testid="l" gap="md">
        x
      </List>,
    )
    expect(screen.getByTestId('l').getAttribute('data-gap')).toBe('md')
  })

  it('forwards marker as data-marker attribute', () => {
    render(
      <List data-testid="l" marker="none">
        x
      </List>,
    )
    expect(screen.getByTestId('l').getAttribute('data-marker')).toBe('none')
  })

  it('forwards additional class names', () => {
    render(
      <List data-testid="l" className="custom">
        x
      </List>,
    )
    expect(screen.getByTestId('l').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(
      <List data-testid="l" aria-label="product features">
        x
      </List>,
    )
    expect(screen.getByTestId('l').getAttribute('aria-label')).toBe('product features')
  })
})
