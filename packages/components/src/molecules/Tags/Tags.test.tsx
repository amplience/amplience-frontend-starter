// @vitest-environment jsdom
//
// Smoke tests for the Tags molecule.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Tags } from './Tags'

afterEach(cleanup)

describe('Tags', () => {
  it('renders a <ul> element', () => {
    render(<Tags data-testid="tl" tags={['a', 'b']} />)
    expect(screen.getByTestId('tl').tagName).toBe('UL')
  })

  it('renders one <Tag> per entry', () => {
    render(<Tags tags={['amplience', 'cms', 'headless']} />)
    expect(screen.getByText('amplience')).toBeTruthy()
    expect(screen.getByText('cms')).toBeTruthy()
    expect(screen.getByText('headless')).toBeTruthy()
  })

  it('returns null for an empty tags array', () => {
    const { container } = render(<Tags tags={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('passes color down to each Tag', () => {
    render(<Tags tags={['a', 'b']} color="primary" />)
    const spans = screen.getAllByText(/^(a|b)$/).map((el) => el.closest('span'))
    for (const span of spans) {
      expect(span?.getAttribute('data-color')).toBe('primary')
    }
  })

  it('uses default Tag color when no color prop is given', () => {
    render(<Tags tags={['x']} />)
    const span = screen.getByText('x').closest('span')
    expect(span?.getAttribute('data-color')).toBe('default')
  })

  it('forwards additional class names onto the <ul>', () => {
    render(<Tags data-testid="tl" tags={['x']} className="custom" />)
    expect(screen.getByTestId('tl').className).toContain('custom')
  })

  it('forwards arbitrary HTML attributes onto the <ul>', () => {
    render(<Tags data-testid="tl" tags={['x']} aria-label="article tags" />)
    expect(screen.getByTestId('tl').getAttribute('aria-label')).toBe('article tags')
  })
})
