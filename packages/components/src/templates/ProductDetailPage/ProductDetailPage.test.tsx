// @vitest-environment jsdom
//
// ProductDetailPage template. The gallery's three forms are the substance here —
// zero, one and many images are three different renderings, not one with
// branches, and each is a real fixture.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { ProductDetailPage } from './ProductDetailPage'

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

describe('ProductDetailPage', () => {
  it('renders the name as the page h1', () => {
    render(<ProductDetailPage name="Aurora Lounge Chair" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Aurora Lounge Chair' })).toBeTruthy()
  })

  it('renders a formatted price', () => {
    render(
      <ProductDetailPage
        name="Aurora"
        price={{ amount: 749, currencyCode: 'GBP' }}
        locale="en-GB"
      />,
    )
    expect(screen.getByText('£749.00')).toBeTruthy()
  })

  it('renders attributes as a description list', () => {
    const { container } = render(
      <ProductDetailPage name="Aurora" attributes={[{ label: 'Frame', value: 'Oiled oak' }]} />,
    )
    expect(container.querySelector('dl')).not.toBeNull()
    expect(screen.getByText('Oiled oak')).toBeTruthy()
  })

  it('renders the editorial slots passed as children', () => {
    render(
      <ProductDetailPage name="Aurora">
        <p>Editorial content</p>
      </ProductDetailPage>,
    )
    expect(screen.getByText('Editorial content')).toBeTruthy()
  })
})

describe('ProductDetailPage — descriptions', () => {
  it('renders the short and the long description', () => {
    render(
      <ProductDetailPage
        name="Chair"
        shortDescription="Short."
        description={'Long.\nSecond line.'}
      />,
    )
    expect(screen.getByText('Short.')).toBeDefined()
    expect(screen.getByText(/Long\.\s+Second line\./)).toBeDefined()
  })

  it('renders neither when both are absent', () => {
    const { container } = render(<ProductDetailPage name="Chair" />)
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })
})

describe('ProductDetailPage — gallery', () => {
  it('renders no gallery at all when there are no images', () => {
    // Not an empty box and not a placeholder: on a PDP there is nothing to
    // reserve space for (ADR-0021).
    const { container } = render(<ProductDetailPage name="Aurora Shelving" />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders a single image as an image, not a one-slide carousel', () => {
    render(<ProductDetailPage name="Aurora" images={[image(1)]} />)
    expect(screen.getByRole('img', { name: 'Chair view 1' })).toBeTruthy()
    // The Carousel molecule labels its region; a lone image must not have one.
    expect(screen.queryByRole('region', { name: /images/ })).toBeNull()
  })

  it('renders several images as a labelled carousel', () => {
    render(<ProductDetailPage name="Aurora" images={[image(1), image(2), image(3)]} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
    // Answers ADR-0020 open question #9 for the gallery case: the accessible
    // name comes from the product, since a gallery has no authored heading.
    expect(screen.getByLabelText('Aurora images')).toBeTruthy()
  })
})

describe('ProductDetailPage — status', () => {
  it('shows no badge for an active product', () => {
    render(<ProductDetailPage name="Aurora" status="active" />)
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

  it('badges a coming-soon product', () => {
    render(<ProductDetailPage name="Aurora" status="coming-soon" />)
    expect(screen.getByText('Coming soon')).toBeTruthy()
  })

  it('badges a discontinued product', () => {
    render(<ProductDetailPage name="Aurora" status="discontinued" />)
    expect(screen.getByText('Discontinued')).toBeTruthy()
  })
})

describe('ProductDetailPage — sparse data', () => {
  it('renders with nothing but a name', () => {
    // `aurora-shelving`: no price, no images, no attributes, no description.
    const { container } = render(<ProductDetailPage name="Aurora Shelving" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(container.querySelector('data')).toBeNull()
    expect(container.querySelector('dl')).toBeNull()
  })

  it('omits an empty attribute list rather than rendering an empty dl', () => {
    const { container } = render(<ProductDetailPage name="Aurora" attributes={[]} />)
    expect(container.querySelector('dl')).toBeNull()
  })

  it('omits empty tags', () => {
    const { container } = render(<ProductDetailPage name="Aurora" tags={[]} />)
    expect(container.querySelector('ul')).toBeNull()
  })

  it('carries its theming hook', () => {
    const { container } = render(<ProductDetailPage name="Aurora" />)
    expect(container.querySelector('article')?.className).toContain('ProductDetailPage')
  })
})
