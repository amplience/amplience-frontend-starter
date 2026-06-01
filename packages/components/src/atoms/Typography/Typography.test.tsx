// @vitest-environment jsdom
//
// Smoke tests for the Typography atom (QL-24).
// We verify element selection and prop pass-through; CSS class values are not
// asserted because the CSS module returns empty strings in the test environment.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Typography } from './Typography'

afterEach(cleanup)

describe('Typography', () => {
  it('renders as <p> by default', () => {
    render(<Typography>Body copy</Typography>)
    expect(screen.getByText('Body copy').tagName).toBe('P')
  })

  it('defaults `as` to `variant` when `as` is not provided', () => {
    render(<Typography variant="h2">Section title</Typography>)
    expect(screen.getByText('Section title').tagName).toBe('H2')
  })

  it('renders the element supplied via `as`', () => {
    render(
      <Typography as="h1" variant="h1">
        Page title
      </Typography>,
    )
    expect(screen.getByText('Page title').tagName).toBe('H1')
  })

  it('decouples visual variant from semantic element', () => {
    // h2 variant on a <p> — visual style is independent of the HTML element.
    render(
      <Typography as="p" variant="h2">
        Display copy
      </Typography>,
    )
    expect(screen.getByText('Display copy').tagName).toBe('P')
  })

  it('forwards additional class names', () => {
    render(<Typography className="custom">Text</Typography>)
    expect(screen.getByText('Text').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(<Typography id="intro">Intro</Typography>)
    expect(screen.getByText('Intro').id).toBe('intro')
  })
})
