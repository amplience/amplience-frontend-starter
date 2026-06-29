// @vitest-environment jsdom
//
// Smoke tests for the Tag atom.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Tag } from './Tag'

afterEach(cleanup)

describe('Tag', () => {
  it('renders a <span> element', () => {
    render(<Tag data-testid="t">label</Tag>)
    expect(screen.getByTestId('t').tagName).toBe('SPAN')
  })

  it('renders children text', () => {
    render(<Tag>amplience</Tag>)
    expect(screen.getByText('amplience')).toBeTruthy()
  })

  it('defaults to color="default"', () => {
    render(<Tag data-testid="t">label</Tag>)
    expect(screen.getByTestId('t').getAttribute('data-color')).toBe('default')
  })

  it('forwards color as data-color attribute', () => {
    render(
      <Tag data-testid="t" color="primary">
        label
      </Tag>,
    )
    expect(screen.getByTestId('t').getAttribute('data-color')).toBe('primary')
  })

  it('applies secondary color', () => {
    render(
      <Tag data-testid="t" color="secondary">
        label
      </Tag>,
    )
    expect(screen.getByTestId('t').getAttribute('data-color')).toBe('secondary')
  })

  it('applies tertiary color', () => {
    render(
      <Tag data-testid="t" color="tertiary">
        label
      </Tag>,
    )
    expect(screen.getByTestId('t').getAttribute('data-color')).toBe('tertiary')
  })

  it('forwards additional class names', () => {
    render(
      <Tag data-testid="t" className="custom">
        label
      </Tag>,
    )
    expect(screen.getByTestId('t').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes', () => {
    render(
      <Tag data-testid="t" aria-label="category tag">
        label
      </Tag>,
    )
    expect(screen.getByTestId('t').getAttribute('aria-label')).toBe('category tag')
  })
})
