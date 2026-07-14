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
})
