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

/** A real product's name and link only — the sparse card the catalogue itself never produces. */
const nameOnly = (slug: string) => {
  const p = storyProduct(slug)
  return { name: p.name, href: p.href, locale: 'en-GB' }
}

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: fromFixture('anyafinn-suede-trench-coat-khaki'),
  render: (args) => <div style={{ maxWidth: '280px' }}>{grid(<ProductCard {...args} />)}</div>,
}

export const OnSale: Story = {
  name: 'On sale — was and now',
  args: {
    ...fromFixture('anyafinn-suede-trench-coat-khaki'),
    price: { amount: 148.75, compareAtAmount: 175, currencyCode: 'GBP' },
  },
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
        <ProductCard {...fromFixture('anyafinn-embossed-floor-lamp')} />
        <ProductCard
          {...fromFixture('anyafinn-terra-stone-effect-coffee-table')}
          status="coming-soon"
        />
        <ProductCard
          {...fromFixture('anyafinn-collared-argyle-cardigan-pink-burgundy')}
          status="discontinued"
        />
      </>,
    ),
}

export const SparseData: Story = {
  name: 'Missing image, price and description',
  render: () =>
    grid(
      <>
        <ProductCard {...fromFixture('anyafinn-suede-trench-coat-khaki')} />
        <ProductCard {...fromFixture('anyafinn-embossed-floor-lamp')} />
        {/* No image and no price — the box is still reserved, so the row
            keeps a straight baseline. */}
        <ProductCard
          {...nameOnly('anyafinn-terra-stone-effect-coffee-table')}
          status="coming-soon"
        />
      </>,
    ),
}

export const LongName: Story = {
  name: 'Long name — layout stress test',
  render: () =>
    grid(
      <>
        <ProductCard
          {...fromFixture('anyafinn-2ft-pre-lit-flocked-christmas-tree-with-burlap-base')}
        />
        <ProductCard {...fromFixture('anyafinn-water-resistant-funnel-neck-jacket-light-beige')} />
      </>,
    ),
}
