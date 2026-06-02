// @vitest-environment jsdom
//
// Smoke tests for the ListItem atom (QL-28).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ListItem } from './ListItem'

afterEach(cleanup)

describe('ListItem', () => {
  it('renders a <li> element', () => {
    render(
      <ul>
        <ListItem data-testid="li">content</ListItem>
      </ul>,
    )
    expect(screen.getByTestId('li').tagName).toBe('LI')
  })

  it('renders children', () => {
    render(
      <ul>
        <ListItem>hello</ListItem>
      </ul>,
    )
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('forwards additional class names', () => {
    render(
      <ul>
        <ListItem data-testid="li" className="custom">
          x
        </ListItem>
      </ul>,
    )
    expect(screen.getByTestId('li').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(
      <ul>
        <ListItem data-testid="li" aria-label="feature item">
          x
        </ListItem>
      </ul>,
    )
    expect(screen.getByTestId('li').getAttribute('aria-label')).toBe('feature item')
  })
})
