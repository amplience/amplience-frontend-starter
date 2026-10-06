import type { Meta, StoryObj } from '@storybook/react'

import type { ResolvedProduct } from '@amplience/frontend-starter-types'

import { storyProducts } from '../../fixtures/products'
import { ProductCarousel } from './ProductCarousel'

/**
 * The fixture products as resolved products — the same mapping the composition
 * boundary does from the port's normalised `Product` (ADR-0027).
 */
export const products: readonly ResolvedProduct[] = storyProducts.map((p) => ({
  sku: p.sku,
  slug: p.slug,
  name: p.name,
  href: p.href,
  ...(p.price !== undefined && { price: p.price }),
  ...(p.images[0] !== undefined && { media: p.images[0] }),
  ...(p.brand !== undefined && { brand: p.brand }),
  ...(p.shortDescription !== undefined && { shortDescription: p.shortDescription }),
  ...(p.status !== undefined && { status: p.status }),
}))

const meta = {
  title: 'Organisms/ProductCarousel',
  component: ProductCarousel,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ProductCarousel>

export default meta
type Story = StoryObj<typeof ProductCarousel>

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: { products, locale: 'en-GB' },
}

export const Peek: Story = {
  name: 'Mobile peek — 1.2 slides',
  args: { products, locale: 'en-GB', slidesMobile: 1.2, slidesTablet: 2, slidesDesktop: 3 },
}

export const FewProducts: Story = {
  name: 'Fewer products than slides — no dead controls',
  args: { products: products.slice(0, 2), locale: 'en-GB', slidesDesktop: 4 },
}

export const SingleProduct: Story = {
  name: 'One product',
  args: { products: products.slice(0, 1), locale: 'en-GB' },
}

export const Empty: Story = {
  name: 'No products — renders nothing',
  args: { products: [] },
}
