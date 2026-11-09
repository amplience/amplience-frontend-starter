import type { Meta, StoryObj } from '@storybook/react'

import { storyResolvedProducts } from '../../fixtures/products'
import { ProductListingPage } from './ProductListingPage'

const meta = {
  title: 'Templates/ProductListingPage',
  component: ProductListingPage,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ProductListingPage>

export default meta
type Story = StoryObj<typeof ProductListingPage>

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: { title: 'Home', products: storyResolvedProducts, locale: 'en-GB' },
}

export const Category: Story = {
  name: 'Category listing',
  args: {
    title: 'Mens Shirts',
    description: 'Oxford, linen and flannel — cut for layering.',
    products: storyResolvedProducts.slice(0, 5),
    locale: 'en-GB',
  },
}

export const AllProducts: Story = {
  name: 'All products (/products)',
  args: {
    title: 'Products',
    description: 'Everything in the catalogue.',
    products: storyResolvedProducts,
    locale: 'en-GB',
  },
}

export const SingleProduct: Story = {
  name: 'One product',
  args: { title: 'Lighting', products: storyResolvedProducts.slice(0, 1), locale: 'en-GB' },
}

export const Empty: Story = {
  name: 'Empty — nothing in this category',
  args: { title: 'Kids Baby', products: [], emptyMessage: 'Nothing in Kids Baby yet.' },
}
