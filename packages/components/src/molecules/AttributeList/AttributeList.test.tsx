// @vitest-environment jsdom
//
// AttributeList molecule — the semantics are the point, so the tests assert
// the dl/dt/dd structure rather than just that text appears.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AttributeList } from './AttributeList'

afterEach(cleanup)

const attributes = [
  { label: 'Material', value: 'Oiled oak' },
  { label: 'Dimensions', value: '78 × 82 × 71 cm' },
]

describe('AttributeList', () => {
  it('renders a description list', () => {
    render(<AttributeList data-testid="l" attributes={attributes} />)
    expect(screen.getByTestId('l').tagName).toBe('DL')
  })

  it('renders each pair as a dt/dd', () => {
    const { container } = render(<AttributeList attributes={attributes} />)
    expect(container.querySelectorAll('dt')).toHaveLength(2)
    expect(container.querySelectorAll('dd')).toHaveLength(2)
    expect(screen.getByText('Material').tagName).toBe('DT')
    expect(screen.getByText('Oiled oak').tagName).toBe('DD')
  })

  it('preserves the order given', () => {
    const { container } = render(<AttributeList attributes={attributes} />)
    const labels = [...container.querySelectorAll('dt')].map((el) => el.textContent)
    expect(labels).toEqual(['Material', 'Dimensions'])
  })

  it('renders nothing for an empty list, so callers need no guard', () => {
    const { container } = render(<AttributeList attributes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('handles repeated labels without collapsing them', () => {
    // Two rows can legitimately share a label; the key pairs label with value.
    render(
      <AttributeList
        attributes={[
          { label: 'Size', value: 'Width 80cm' },
          { label: 'Size', value: 'Depth 45cm' },
        ]}
      />,
    )
    expect(screen.getAllByText('Size')).toHaveLength(2)
  })

  it('carries its theming hook and forwards a className', () => {
    render(<AttributeList data-testid="l" attributes={attributes} className="custom" />)
    const { className } = screen.getByTestId('l')
    expect(className).toContain('AttributeList')
    expect(className).toContain('custom')
  })
})
