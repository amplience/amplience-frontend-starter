import type { Meta, StoryObj } from '@storybook/react'

import { products } from '../ProductCarousel/ProductCarousel.stories'
import { ProductCarouselBlock } from './ProductCarouselBlock'

const meta = {
  title: 'Organisms/ProductCarouselBlock',
  component: ProductCarouselBlock,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ProductCarouselBlock>

export default meta
type Story = StoryObj<typeof ProductCarouselBlock>

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: { products, locale: 'en-GB', sectionHeader: { title: 'New in' } },
}

export const WithoutHeader: Story = {
  name: 'No section header',
  args: { products, locale: 'en-GB' },
}

export const OnABand: Story = {
  name: 'On a colour band',
  args: {
    products,
    locale: 'en-GB',
    sectionHeader: { title: 'Seating', description: 'Everything with a seat.' },
    backgroundColor: 'light',
  },
}

export const EdgeToEdge: Story = {
  name: 'No gutter — slides run to the edge',
  args: { products, locale: 'en-GB', sectionHeader: { title: 'Edge to edge' }, gutter: false },
}

export const SparseData: Story = {
  name: 'Mixed — missing images, prices and a coming-soon',
  args: {
    products,
    locale: 'en-GB',
    sectionHeader: {
      title: 'The full fixture set',
      description: 'Includes the product with no image and no price.',
    },
  },
}

export const Empty: Story = {
  name: 'Nothing resolved — renders nothing',
  args: { products: [], sectionHeader: { title: 'Never shown' } },
}
