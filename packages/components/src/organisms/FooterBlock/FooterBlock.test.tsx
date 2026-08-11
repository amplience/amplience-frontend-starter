// @vitest-environment jsdom
//
// Smoke + prop-plumbing tests for the FooterBlock organism and its rows.
// Both are presentational: they render a landmark and hand their styling
// decisions to CSS via data attributes, so what's worth pinning is the
// attributes brands select on — those are the component's public contract
// with a brand stylesheet, and a rename here breaks themes silently.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FooterBlock } from './FooterBlock'
import { FooterRow } from './FooterRow'

afterEach(cleanup)

describe('FooterBlock', () => {
  it('renders a contentinfo landmark around its children', () => {
    render(
      <FooterBlock>
        <span>links</span>
      </FooterBlock>,
    )
    expect(screen.getByRole('contentinfo').textContent).toBe('links')
  })

  it('omits data-sticky entirely when not sticky', () => {
    // `data-sticky="false"` would still match [data-sticky] in CSS, so the
    // attribute has to be absent rather than falsy.
    const { container } = render(<FooterBlock />)
    expect(container.querySelector('footer')?.hasAttribute('data-sticky')).toBe(false)
  })

  it('sets data-sticky when sticky', () => {
    render(<FooterBlock sticky />)
    expect(screen.getByRole('contentinfo').getAttribute('data-sticky')).toBe('true')
  })

  it('defaults max-width and passes an explicit one through', () => {
    const { container } = render(<FooterBlock />)
    expect(container.querySelector('footer')?.getAttribute('data-max-width')).toBe('default')

    cleanup()
    render(<FooterBlock maxWidth="wide" />)
    expect(screen.getByRole('contentinfo').getAttribute('data-max-width')).toBe('wide')
  })

  it('applies the caller className alongside the component class', () => {
    render(<FooterBlock className="SiteFooter" />)
    const el = screen.getByRole('contentinfo')
    expect(el.classList.contains('FooterBlock')).toBe(true)
    expect(el.classList.contains('SiteFooter')).toBe(true)
  })
})

describe('FooterRow', () => {
  it('renders its children inside the row', () => {
    const { container } = render(
      <FooterRow>
        <span>logo</span>
      </FooterRow>,
    )
    expect(container.textContent).toBe('logo')
  })

  it('leaves data-color unset when no background token is given', () => {
    // An unset row inherits the block's palette; emitting an empty data-color
    // would match [data-color] and override it.
    const { container } = render(<FooterRow />)
    expect(container.querySelector('.FooterRow')?.hasAttribute('data-color')).toBe(false)
  })

  it('sets data-color from the background token', () => {
    const { container } = render(<FooterRow backgroundColor="dark" />)
    expect(container.querySelector('.FooterRow')?.getAttribute('data-color')).toBe('dark')
  })

  it('constrains only the inner container, not the row itself', () => {
    // The row spans the viewport so its background bleeds edge to edge; the
    // max-width applies to the Container inside it.
    const { container } = render(<FooterRow maxWidth="narrow" />)
    const row = container.querySelector('.FooterRow')
    expect(row?.hasAttribute('data-max-width')).toBe(false)
    expect(row?.querySelector('.Container')).not.toBeNull()
  })
})
