import type { Meta, StoryObj } from '@storybook/react'

import type { ContentMediaData } from '@amplience/frontend-starter-types'

import { ProductCard } from './ProductCard'

const media: ContentMediaData = {
  mediaType: 'ManualImage',
  image: {
    src: 'https://picsum.photos/seed/product-aurora-lounge-chair/800/800',
    alt: 'Aurora Lounge Chair',
    width: 800,
    height: 800,
  },
}

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

const grid = (children: React.ReactNode) => (
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

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    name: 'Aurora Lounge Chair',
    href: '/products/aurora-lounge-chair',
    price: { amount: 749, currencyCode: 'GBP' },
    shortDescription: 'A low-slung lounge chair in oiled oak and wool bouclé.',
    media,
    locale: 'en-GB',
  },
  render: (args) => <div style={{ maxWidth: '280px' }}>{grid(<ProductCard {...args} />)}</div>,
}

export const States: Story = {
  name: 'Status badges',
  render: () =>
    grid(
      <>
        <ProductCard
          name="Active"
          href="#"
          price={{ amount: 749, currencyCode: 'GBP' }}
          media={media}
          locale="en-GB"
        />
        <ProductCard
          name="Coming soon"
          href="#"
          status="coming-soon"
          media={media}
          locale="en-GB"
        />
        <ProductCard
          name="Discontinued"
          href="#"
          status="discontinued"
          price={{ amount: 45, currencyCode: 'GBP' }}
          media={media}
          locale="en-GB"
        />
      </>,
    ),
}

export const SparseData: Story = {
  name: 'Missing image, price and description',
  render: () =>
    grid(
      <>
        <ProductCard
          name="Everything"
          href="#"
          price={{ amount: 749, currencyCode: 'GBP' }}
          shortDescription="Full card."
          media={media}
          locale="en-GB"
        />
        <ProductCard
          name="No image"
          href="#"
          price={{ amount: 229, currencyCode: 'GBP' }}
          shortDescription="Box is reserved so the row stays aligned."
          locale="en-GB"
        />
        <ProductCard name="Aurora Shelving" href="#" status="coming-soon" />
      </>,
    ),
}

export const LongName: Story = {
  name: 'Long name — layout stress test',
  render: () =>
    grid(
      <>
        <ProductCard
          name="Mara Hand-Woven Undyed Wool Throw"
          href="#"
          price={{ amount: 95, currencyCode: 'GBP' }}
          shortDescription="Undyed wool, woven on a hand loom."
          media={media}
          locale="en-GB"
        />
        <ProductCard
          name="Short"
          href="#"
          price={{ amount: 45, currencyCode: 'GBP' }}
          media={media}
          locale="en-GB"
        />
      </>,
    ),
}
