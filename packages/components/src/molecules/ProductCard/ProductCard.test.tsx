// @vitest-environment jsdom
//
// ProductCard molecule. The interesting cases are the absent ones — a
// product with no image, no price or no description still has to render a
// legible card, because `aurora-shelving` is exactly that.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { ProductCard } from './ProductCard'

afterEach(cleanup)

const media: ContentMediaData = {
  mediaType: 'ManualImage',
  image: { src: 'https://example.invalid/chair.jpg', alt: 'A chair', width: 800, height: 800 },
}

const base = { name: 'Aurora Lounge Chair', href: '/products/aurora-lounge-chair' }

describe('ProductCard', () => {
  it('renders the name as a heading', () => {
    render(<ProductCard {...base} />)
    expect(screen.getByRole('heading', { name: 'Aurora Lounge Chair' })).toBeTruthy()
  })

  it('makes the whole card one link', () => {
    render(<ProductCard {...base} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe('/products/aurora-lounge-chair')
  })

  it('renders a formatted price when there is one', () => {
    render(<ProductCard {...base} price={{ amount: 749, currencyCode: 'GBP' }} locale="en-GB" />)
    expect(screen.getByText('£749.00')).toBeTruthy()
  })

  it('renders no price element at all when there is none', () => {
    const { container } = render(<ProductCard {...base} />)
    expect(container.querySelector('data')).toBeNull()
  })

  it('renders the image when given one', () => {
    render(<ProductCard {...base} media={media} />)
    expect(screen.getByRole('img', { name: 'A chair' })).toBeTruthy()
  })

  it('renders without an image, keeping the media box for row alignment', () => {
    const { container } = render(<ProductCard {...base} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-empty="true"]')).not.toBeNull()
  })

  it('shows no badge for an active product', () => {
    render(<ProductCard {...base} status="active" />)
    expect(screen.queryByText('Coming soon')).toBeNull()
    expect(screen.queryByText('Discontinued')).toBeNull()
  })

  it('badges a coming-soon product', () => {
    render(<ProductCard {...base} status="coming-soon" />)
    expect(screen.getByText('Coming soon')).toBeTruthy()
  })

  it('badges a discontinued product', () => {
    render(<ProductCard {...base} status="discontinued" />)
    expect(screen.getByText('Discontinued')).toBeTruthy()
  })

  it('renders the short description when given one', () => {
    render(<ProductCard {...base} shortDescription="A low-slung chair." />)
    expect(screen.getByText('A low-slung chair.')).toBeTruthy()
  })

  it('renders the bare minimum — name and link only', () => {
    // The `coming-soon` fixture: no image, no price, no description.
    render(<ProductCard name="Aurora Shelving" href="/products/aurora-shelving" />)
    expect(screen.getByRole('heading', { name: 'Aurora Shelving' })).toBeTruthy()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('carries its theming hook and forwards a className', () => {
    const { container } = render(<ProductCard {...base} className="custom" />)
    const root = container.querySelector('a')
    expect(root?.className).toContain('ProductCard')
    expect(root?.className).toContain('custom')
  })

  it('renders the heading at the requested level', () => {
    render(<ProductCard {...base} headingVariant="h2" />)
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy()
  })
})
