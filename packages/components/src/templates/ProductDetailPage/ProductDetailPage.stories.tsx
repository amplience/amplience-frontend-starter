import type { Meta, StoryObj } from '@storybook/react'

import { storyProductIn } from '../../fixtures/products'
import { ProductDetailPage } from './ProductDetailPage'

const meta = {
  title: 'Templates/ProductDetailPage',
  component: ProductDetailPage,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ProductDetailPage>

export default meta
type Story = StoryObj<typeof ProductDetailPage>

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
    ...(p.brand !== undefined && { brand: p.brand }),
    ...(p.status !== undefined && { status: p.status }),
  }
}

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: fromFixture('anyafinn-suede-trench-coat-khaki'),
}

export const Gallery: Story = {
  name: 'Gallery — four images',
  args: fromFixture('anyafinn-tailored-overcoat-brown'),
}

export const SingleImage: Story = {
  name: 'One image — renders an image, not a carousel',
  args: fromFixture('anyafinn-embossed-floor-lamp'),
}

export const NoImages: Story = {
  name: 'No images — no gallery region at all',
  args: { ...fromFixture('anyafinn-embossed-floor-lamp'), images: [] },
}

export const Discontinued: Story = {
  name: 'Discontinued',
  args: {
    ...fromFixture('anyafinn-collared-argyle-cardigan-pink-burgundy'),
    status: 'discontinued',
  },
}

export const LongName: Story = {
  name: 'Long name',
  args: fromFixture('anyafinn-2ft-pre-lit-flocked-christmas-tree-with-burlap-base'),
}

export const WithEditorialContent: Story = {
  name: 'With editorial slots',
  args: fromFixture('anyafinn-terra-stone-effect-coffee-table'),
  render: (args) => (
    <ProductDetailPage {...args}>
      {/* Stands in for the rendered slots — the real page passes the
          renderer's output for the product's `slots` array. */}
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem' }}>
        <h2>The detail</h2>
        <p>
          Corners and edges are rounded off so the block softens rather than looms, and the
          cross-shaped plinth lifts the top just enough to cast a shadow line beneath.
        </p>
      </div>
    </ProductDetailPage>
  ),
}

export const Localized: Story = {
  name: 'German locale — name, description and price all shift',
  args: fromFixture('anyafinn-suede-trench-coat-khaki', 'de-DE'),
}

export const AsLcp: Story = {
  name: 'Lead image as LCP candidate',
  args: { ...fromFixture('anyafinn-suede-trench-coat-khaki'), loadPriority: 'lcp' },
}
