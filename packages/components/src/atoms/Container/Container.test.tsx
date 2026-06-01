// @vitest-environment jsdom
//
// Smoke tests for the Container atom (QL-27).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Container } from './Container'

afterEach(cleanup)

describe('Container', () => {
  it('renders a <div> element', () => {
    render(<Container data-testid="c">content</Container>)
    expect(screen.getByTestId('c').tagName).toBe('DIV')
  })

  it('renders children', () => {
    render(<Container>hello</Container>)
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('defaults to data-max-width="default"', () => {
    render(<Container data-testid="c">x</Container>)
    expect(screen.getByTestId('c').getAttribute('data-max-width')).toBe('default')
  })

  it('forwards maxWidth as data-max-width attribute', () => {
    render(
      <Container data-testid="c" maxWidth="wide">
        x
      </Container>,
    )
    expect(screen.getByTestId('c').getAttribute('data-max-width')).toBe('wide')
  })

  it('forwards additional class names', () => {
    render(
      <Container data-testid="c" className="custom">
        x
      </Container>,
    )
    expect(screen.getByTestId('c').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(
      <Container data-testid="c" aria-label="page wrapper">
        x
      </Container>,
    )
    expect(screen.getByTestId('c').getAttribute('aria-label')).toBe('page wrapper')
  })

  it('does not set data-gutter when gutter is omitted', () => {
    render(<Container data-testid="c">x</Container>)
    expect(screen.getByTestId('c').hasAttribute('data-gutter')).toBe(false)
  })

  it('sets data-gutter attribute when gutter is true', () => {
    render(
      <Container data-testid="c" gutter>
        x
      </Container>,
    )
    expect(screen.getByTestId('c').hasAttribute('data-gutter')).toBe(true)
  })
})
