// @vitest-environment jsdom
//
// Smoke tests for the Stack atom (QL-27).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Stack } from './Stack'

afterEach(cleanup)

describe('Stack', () => {
  it('renders a <div> element', () => {
    render(<Stack data-testid="s">content</Stack>)
    expect(screen.getByTestId('s').tagName).toBe('DIV')
  })

  it('renders children', () => {
    render(<Stack>hello</Stack>)
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('defaults to column direction', () => {
    render(<Stack data-testid="s">x</Stack>)
    expect(screen.getByTestId('s').getAttribute('data-direction')).toBe('column')
  })

  it('defaults to md gap', () => {
    render(<Stack data-testid="s">x</Stack>)
    expect(screen.getByTestId('s').getAttribute('data-gap')).toBe('md')
  })

  it('forwards direction as data-direction attribute', () => {
    render(
      <Stack data-testid="s" direction="row">
        x
      </Stack>,
    )
    expect(screen.getByTestId('s').getAttribute('data-direction')).toBe('row')
  })

  it('forwards gap as data-gap attribute', () => {
    render(
      <Stack data-testid="s" gap="xl">
        x
      </Stack>,
    )
    expect(screen.getByTestId('s').getAttribute('data-gap')).toBe('xl')
  })

  it('defaults to nowrap', () => {
    render(<Stack data-testid="s">x</Stack>)
    expect(screen.getByTestId('s').getAttribute('data-wrap')).toBe(null)
  })

  it('supports wrapping children', () => {
    render(
      <Stack data-testid="s" wrap>
        x
      </Stack>,
    )
    expect(screen.getByTestId('s').getAttribute('data-wrap')).toBe('true')
  })

  it('forwards additional class names', () => {
    render(
      <Stack data-testid="s" className="custom">
        x
      </Stack>,
    )
    expect(screen.getByTestId('s').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(
      <Stack data-testid="s" aria-label="form fields">
        x
      </Stack>,
    )
    expect(screen.getByTestId('s').getAttribute('aria-label')).toBe('form fields')
  })
})
