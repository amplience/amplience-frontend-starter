// @vitest-environment jsdom
//
// ProductCarouselBlock organism. The absent cases carry the weight: a rail
// whose SKUs all failed to resolve is a real state, not an error.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ResolvedProduct } from '@amplience/frontend-starter-types'

import { ProductCarouselBlock } from './ProductCarouselBlock'

afterEach(cleanup)

const product = (sku: string): ResolvedProduct => ({
  sku,
  slug: sku.toLowerCase(),
  name: `Product ${sku}`,
  href: `/products/${sku.toLowerCase()}`,
})

const products = [product('A'), product('B')]

describe('ProductCarouselBlock', () => {
  it('renders a card per product, in the order given', () => {
    render(<ProductCarouselBlock products={products} />)
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/products/a', '/products/b'])
  })

  it('renders the section header when one is authored', () => {
    render(<ProductCarouselBlock products={products} sectionHeader={{ title: 'New in' }} />)
    expect(screen.getByText('New in')).toBeTruthy()
  })

  it('names the rail after the section header title', () => {
    // Saves asking the author for the same words twice, and a page with several
    // rails stays navigable.
    render(<ProductCarouselBlock products={products} sectionHeader={{ title: 'Seating' }} />)
    expect(screen.getByRole('group', { name: 'Seating' })).toBeTruthy()
  })

  it('falls back to a generic rail name with no header', () => {
    render(<ProductCarouselBlock products={products} />)
    expect(screen.getByRole('group', { name: 'Products' })).toBeTruthy()
  })

  it('renders nothing at all when no products resolved', () => {
    // Not an empty band with a heading — that reads as a fault rather than
    // as absence.
    const { container } = render(
      <ProductCarouselBlock products={[]} sectionHeader={{ title: 'Never shown' }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('carries its theming hook and forwards a className', () => {
    const { container } = render(<ProductCarouselBlock products={products} className="custom" />)
    const root = container.querySelector('section')
    expect(root?.className).toContain('ProductCarouselBlock')
    expect(root?.className).toContain('custom')
  })

  it('exposes the background band as a data attribute', () => {
    const { container } = render(
      <ProductCarouselBlock products={products} backgroundColor="light" />,
    )
    expect(container.querySelector('[data-background-color="light"]')).not.toBeNull()
  })
})
