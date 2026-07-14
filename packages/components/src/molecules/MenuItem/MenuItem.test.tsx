// @vitest-environment jsdom
//
// Smoke tests for MenuItem (ADR-0015). Nav links route through the Link atom
// so they carry the active locale prefix; next/link is mocked to a plain <a>
// so we can read the resolved href.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MenuItem } from './MenuItem'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe('MenuItem', () => {
  it('renders a navigable item as a link', () => {
    render(<MenuItem label="About" link="/about" />)
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about')
  })

  it('prefixes the link with the active locale base', () => {
    render(<MenuItem label="About" link="/about" localeBasePath="/fr-fr" />)
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/fr-fr/about')
  })

  it('renders a label-only item (no link) as text, not a link', () => {
    render(<MenuItem label="Products" localeBasePath="/fr-fr" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Products')).toBeDefined()
  })

  it('renders a decorative icon alongside the label, keeping the label as the accessible name', () => {
    render(<MenuItem label="Shopping cart" link="/cart" icon="cart" />)
    const link = screen.getByRole('link', { name: 'Shopping cart' })
    // The icon renders as an (aria-hidden) svg inside the link.
    expect(link.querySelector('svg')).not.toBeNull()
  })

  it('renders no icon when the icon prop is omitted', () => {
    render(<MenuItem label="About" link="/about" />)
    expect(screen.getByRole('link', { name: 'About' }).querySelector('svg')).toBeNull()
  })

  it('still renders the item when a visibility restriction is set', () => {
    render(<MenuItem label="Shopping cart" link="/cart" icon="cart" visibility="mobileOnly" />)
    expect(screen.getByRole('link', { name: 'Shopping cart' })).toBeDefined()
  })
})
