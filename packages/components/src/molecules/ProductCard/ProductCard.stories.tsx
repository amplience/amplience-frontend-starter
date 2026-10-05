import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { storyProduct, storyProducts } from '../../fixtures/products'
import { ProductCard } from './ProductCard'

const meta = {
  title: 'Molecules/ProductCard',
  component: ProductCard,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'padded',
  },
} satisfies Meta<typeof ProductCard>

export default meta
type Story = StoryObj<typeof ProductCard>

const grid = (children: ReactNode) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '1rem',
      maxWidth: '900px',
    }}
  >
    {children}
  </div>
)

/** Spread a fixture product into the card's props. */
const fromFixture = (slug: string) => {
  const p = storyProduct(slug)
  return {
    name: p.name,
    href: p.href,
    locale: 'en-GB',
    ...(p.price !== undefined && { price: p.price }),
    ...(p.images[0] !== undefined && { media: p.images[0] }),
    ...(p.brand !== undefined && { brand: p.brand }),
    ...(p.shortDescription !== undefined && { shortDescription: p.shortDescription }),
    ...(p.status !== undefined && { status: p.status }),
  }
}

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: fromFixture('aurora-lounge-chair'),
  render: (args) => <div style={{ maxWidth: '280px' }}>{grid(<ProductCard {...args} />)}</div>,
}

export const TheFixtureSet: Story = {
  name: 'Every fixture product',
  render: () =>
    grid(
      <>
        {storyProducts.map((p) => (
          <ProductCard key={p.slug} {...fromFixture(p.slug)} />
        ))}
      </>,
    ),
}

export const States: Story = {
  name: 'Status badges',
  render: () =>
    grid(
      <>
        <ProductCard {...fromFixture('aurora-side-table')} />
        <ProductCard {...fromFixture('aurora-shelving')} />
        <ProductCard {...fromFixture('verde-ceramic-planter')} />
      </>,
    ),
}

export const SparseData: Story = {
  name: 'Missing image, price and description',
  render: () =>
    grid(
      <>
        <ProductCard {...fromFixture('aurora-lounge-chair')} />
        <ProductCard {...fromFixture('lumen-floor-lamp')} />
        {/* No image and no price — the box is still reserved, so the row
            keeps a straight baseline. */}
        <ProductCard {...fromFixture('aurora-shelving')} />
      </>,
    ),
}

export const LongName: Story = {
  name: 'Long name — layout stress test',
  render: () =>
    grid(
      <>
        <ProductCard {...fromFixture('mara-hand-woven-wool-throw')} />
        <ProductCard {...fromFixture('verde-ceramic-planter')} />
      </>,
    ),
}
