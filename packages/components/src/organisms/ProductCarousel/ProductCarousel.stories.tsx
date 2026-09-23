import type { Meta, StoryObj } from '@storybook/react'

import { storyProducts } from '../../fixtures/products'
import { ProductCarousel } from './ProductCarousel'
import type { ProductCarouselItem } from './ProductCarousel'

/**
 * The fixture products as carousel items — the same mapping the composition
 * boundary does from the port's normalised `Product`.
 */
const items: readonly ProductCarouselItem[] = storyProducts.map((p) => ({
  slug: p.slug,
  name: p.name,
  href: p.href,
  ...(p.price !== undefined && { price: p.price }),
  ...(p.images[0] !== undefined && { media: p.images[0] }),
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
  args: {
    products: items,
    locale: 'en-GB',
    sectionHeader: { title: 'New in' },
  },
}

export const WithoutHeader: Story = {
  name: 'No section header',
  args: { products: items, locale: 'en-GB' },
}

export const Peek: Story = {
  name: 'Mobile peek — 1.2 slides',
  args: {
    products: items,
    locale: 'en-GB',
    sectionHeader: { title: 'Seating' },
    slidesMobile: 1.2,
    slidesTablet: 2,
    slidesDesktop: 3,
  },
}

export const FewProducts: Story = {
  name: 'Fewer products than slides — no dead controls',
  args: {
    products: items.slice(0, 2),
    locale: 'en-GB',
    sectionHeader: { title: 'Just two' },
    slidesDesktop: 4,
  },
}

export const SingleProduct: Story = {
  name: 'One product',
  args: { products: items.slice(0, 1), locale: 'en-GB' },
}

export const Empty: Story = {
  name: 'No products — renders nothing',
  args: { products: [] },
}

export const SparseData: Story = {
  name: 'Mixed — missing images, prices and a coming-soon',
  args: {
    products: items,
    locale: 'en-GB',
    sectionHeader: {
      title: 'The full fixture set',
      description: 'Includes the product with no image and no price.',
    },
  },
}
