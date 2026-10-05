// @vitest-environment jsdom
//
// ProductDetail template. The gallery's three forms are the substance here —
// zero, one and many images are three different renderings, not one with
// branches, and each is a real fixture.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { ProductDetail } from './ProductDetail'

afterEach(cleanup)

const image = (n: number): ContentMediaData => ({
  mediaType: 'ManualImage',
  image: {
    src: `https://example.invalid/chair-${String(n)}.jpg`,
    alt: `Chair view ${String(n)}`,
    width: 800,
    height: 800,
  },
})

describe('ProductDetail', () => {
  it('renders the name as the page h1', () => {
    render(<ProductDetail name="Aurora Lounge Chair" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Aurora Lounge Chair' })).toBeTruthy()
  })

  it('renders a formatted price', () => {
    render(
      <ProductDetail name="Aurora" price={{ amount: 749, currencyCode: 'GBP' }} locale="en-GB" />,
    )
    expect(screen.getByText('£749.00')).toBeTruthy()
  })

  it('renders attributes as a description list', () => {
    const { container } = render(
      <ProductDetail name="Aurora" attributes={[{ label: 'Frame', value: 'Oiled oak' }]} />,
    )
    expect(container.querySelector('dl')).not.toBeNull()
    expect(screen.getByText('Oiled oak')).toBeTruthy()
  })

  it('renders the editorial slots passed as children', () => {
    render(
      <ProductDetail name="Aurora">
        <p>Editorial content</p>
      </ProductDetail>,
    )
    expect(screen.getByText('Editorial content')).toBeTruthy()
  })
})

describe('ProductDetail — gallery', () => {
  it('renders no gallery at all when there are no images', () => {
    // Not an empty box and not a placeholder: on a PDP there is nothing to
    // reserve space for (ADR-0021).
    const { container } = render(<ProductDetail name="Aurora Shelving" />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders a single image as an image, not a one-slide carousel', () => {
    render(<ProductDetail name="Aurora" images={[image(1)]} />)
    expect(screen.getByRole('img', { name: 'Chair view 1' })).toBeTruthy()
    // The Carousel molecule labels its region; a lone image must not have one.
    expect(screen.queryByRole('region', { name: /images/ })).toBeNull()
  })

  it('renders several images as a labelled carousel', () => {
    render(<ProductDetail name="Aurora" images={[image(1), image(2), image(3)]} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
    // Answers ADR-0020 open question #9 for the gallery case: the accessible
    // name comes from the product, since a gallery has no authored heading.
    expect(screen.getByLabelText('Aurora images')).toBeTruthy()
  })
})

describe('ProductDetail — status', () => {
  it('shows no badge for an active product', () => {
    render(<ProductDetail name="Aurora" status="active" />)
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

  it('badges a coming-soon product', () => {
    render(<ProductDetail name="Aurora" status="coming-soon" />)
    expect(screen.getByText('Coming soon')).toBeTruthy()
  })

  it('badges a discontinued product', () => {
    render(<ProductDetail name="Aurora" status="discontinued" />)
    expect(screen.getByText('Discontinued')).toBeTruthy()
  })
})

describe('ProductDetail — sparse data', () => {
  it('renders with nothing but a name', () => {
    // `aurora-shelving`: no price, no images, no attributes, no description.
    const { container } = render(<ProductDetail name="Aurora Shelving" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(container.querySelector('data')).toBeNull()
    expect(container.querySelector('dl')).toBeNull()
  })

  it('omits an empty attribute list rather than rendering an empty dl', () => {
    const { container } = render(<ProductDetail name="Aurora" attributes={[]} />)
    expect(container.querySelector('dl')).toBeNull()
  })

  it('omits empty tags', () => {
    const { container } = render(<ProductDetail name="Aurora" tags={[]} />)
    expect(container.querySelector('ul')).toBeNull()
  })

  it('carries its theming hook', () => {
    const { container } = render(<ProductDetail name="Aurora" />)
    expect(container.querySelector('article')?.className).toContain('ProductDetail')
  })
})
