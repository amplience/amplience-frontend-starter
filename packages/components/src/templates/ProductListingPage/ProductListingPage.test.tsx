import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ResolvedProduct } from '@amplience/frontend-starter-types'

import { ProductListingPage } from './ProductListingPage'

afterEach(cleanup)

const product = (n: number): ResolvedProduct => ({
  sku: `SKU-${n}`,
  slug: `product-${n}`,
  name: `Product ${n}`,
  href: `/products/product-${n}`,
})

describe('ProductListingPage', () => {
  it('renders the title as the page h1', () => {
    render(<ProductListingPage title="Mens Shirts" products={[product(1)]} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Mens Shirts' })).toBeDefined()
  })

  it('renders a card per product, linked, in the order given', () => {
    render(<ProductListingPage title="All" products={[product(2), product(1)]} />)
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/products/product-2',
      '/products/product-1',
    ])
  })

  it('shows the empty message instead of a grid when there is nothing to list', () => {
    render(<ProductListingPage title="Kids" products={[]} emptyMessage="Nothing in Kids yet." />)
    expect(screen.getByText('Nothing in Kids yet.')).toBeDefined()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders an optional description', () => {
    render(<ProductListingPage title="Lighting" description="Lamps, mostly." products={[]} />)
    expect(screen.getByText('Lamps, mostly.')).toBeDefined()
  })

  it('carries its theming hook', () => {
    const { container } = render(<ProductListingPage title="All" products={[]} />)
    expect(container.firstElementChild?.classList.contains('ProductListingPage')).toBe(true)
  })
})
