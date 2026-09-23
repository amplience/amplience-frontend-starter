import type { Meta, StoryObj } from '@storybook/react'

import { storyProductIn } from '../../fixtures/products'
import { ProductDetail } from './ProductDetail'

const meta = {
  title: 'Templates/ProductDetail',
  component: ProductDetail,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ProductDetail>

export default meta
type Story = StoryObj<typeof ProductDetail>

/** Spread a fixture product into the template's props. */
const fromFixture = (slug: string, locale = 'en-GB') => {
  const p = storyProductIn(slug, locale)
  return {
    name: p.name,
    images: p.images,
    attributes: p.attributes,
    tags: p.tags,
    locale,
    ...(p.price !== undefined && { price: p.price }),
    ...(p.shortDescription !== undefined && { shortDescription: p.shortDescription }),
    ...(p.category !== undefined && { category: p.category }),
    ...(p.status !== undefined && { status: p.status }),
  }
}

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: fromFixture('aurora-lounge-chair'),
}

export const Gallery: Story = {
  name: 'Gallery — six images',
  args: fromFixture('aurora-lounge-chair'),
}

export const SingleImage: Story = {
  name: 'One image — renders an image, not a carousel',
  args: fromFixture('aurora-side-table'),
}

export const NoImages: Story = {
  name: 'No images — no gallery region at all',
  args: fromFixture('aurora-shelving'),
}

export const Discontinued: Story = {
  name: 'Discontinued',
  args: fromFixture('verde-ceramic-planter'),
}

export const LongName: Story = {
  name: 'Long name',
  args: fromFixture('mara-hand-woven-wool-throw'),
}

export const WithEditorialContent: Story = {
  name: 'With editorial slots',
  args: fromFixture('terra-dining-table'),
  render: (args) => (
    <ProductDetail {...args}>
      {/* Stands in for the rendered slots — the real page passes the
          renderer's output for the product's `slots` array. */}
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem' }}>
        <h2>Reclaimed, not reproduced</h2>
        <p>
          Every Terra top is milled from elm salvaged from farm buildings in the Welsh borders. No
          two are the same colour, and the nail-holes are left in.
        </p>
      </div>
    </ProductDetail>
  ),
}

export const Localized: Story = {
  name: 'German locale — name, description and price all shift',
  args: fromFixture('aurora-lounge-chair', 'de-DE'),
}

export const AsLcp: Story = {
  name: 'Lead image as LCP candidate',
  args: { ...fromFixture('aurora-lounge-chair'), loadPriority: 'lcp' },
}
