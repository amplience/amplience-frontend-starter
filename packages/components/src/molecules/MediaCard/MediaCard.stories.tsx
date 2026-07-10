import type { Meta, StoryObj } from '@storybook/react'

import { MediaCard } from './MediaCard'

const meta = {
  title: 'Molecules/MediaCard',
  component: MediaCard,
  tags: ['autodocs'],
  argTypes: {
    layout: {
      control: 'radio',
      options: ['above', 'beside', 'dynamic', 'overlay'],
    },
    headingVariant: {
      control: 'radio',
      options: ['h2', 'h3', 'h4', 'h5', 'h6'],
    },
    elevation: {
      control: 'radio',
      options: ['flat', 'raised', 'bordered'],
    },
    color: {
      control: 'select',
      options: ['white', 'light', 'dark', 'black', 'primary', 'secondary', 'tertiary'],
    },
    links: { control: 'object' },
    description: { control: 'text' },
  },
  parameters: {
    controls: { disable: true },
    layout: 'padded',
  },
} satisfies Meta<typeof MediaCard>

export default meta
type Story = StoryObj<typeof MediaCard>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const landscapeMedia = {
  mediaType: 'ManualImage' as const,
  image: {
    src: 'https://picsum.photos/seed/ql-mc/800/450',
    alt: 'A sample product image',
    width: 800,
    height: 450,
  },
}

const squareMedia = {
  mediaType: 'ManualImage' as const,
  image: {
    src: 'https://picsum.photos/seed/ql-mc-sq/600/600',
    alt: 'A square product image',
    width: 600,
    height: 600,
  },
}

const baseCopy = {
  title: 'Spring collection',
  description:
    'Lightweight pieces designed for the transition season. Versatile styling, sustainable materials.',
} as const

// ---------------------------------------------------------------------------
// Playground
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    ...baseCopy,
    media: { ...landscapeMedia },
    layout: 'above',
    elevation: 'raised',
    color: 'white',
  },
}

// ---------------------------------------------------------------------------
// Layout variants
// ---------------------------------------------------------------------------

export const Above: Story = {
  name: 'Layout — above (default)',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard {...baseCopy} media={{ ...landscapeMedia }} layout="above" />
    </div>
  ),
}

export const Beside: Story = {
  name: 'Layout — beside',
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <MediaCard {...baseCopy} media={{ ...squareMedia }} layout="beside" />
    </div>
  ),
}

export const Dynamic: Story = {
  name: 'Layout — dynamic (resize to see switch at 380px)',
  render: () => (
    <div style={{ maxWidth: 560, resize: 'horizontal', overflow: 'hidden' }}>
      <MediaCard {...baseCopy} media={{ ...squareMedia }} layout="dynamic" />
    </div>
  ),
}

export const Overlay: Story = {
  name: 'Layout — overlay',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard
        title="Spring collection"
        description="Lightweight, versatile pieces."
        media={{ ...landscapeMedia }}
        layout="overlay"
      />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// Linking
// ---------------------------------------------------------------------------

export const WholeCardLink: Story = {
  name: 'Linked — whole card',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard {...baseCopy} media={{ ...landscapeMedia }} links={{ href: '/products/spring' }} />
    </div>
  ),
}

export const ExplicitCta: Story = {
  name: 'CTA — explicit action button',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard
        {...baseCopy}
        media={{ ...landscapeMedia }}
        links={{ cta: { label: 'Shop now', href: '/products/spring' } }}
      />
    </div>
  ),
}

export const LinkedExternal: Story = {
  name: 'Linked — external URL (new tab)',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard
        title="Amplience"
        description="The content management platform powering this accelerator."
        media={{ ...landscapeMedia }}
        links={{ href: 'https://amplience.com' }}
      />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// No image — text only
// ---------------------------------------------------------------------------

export const TextOnly: Story = {
  name: 'No image — text only',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard
        title="Text-only card"
        description="Image is optional. The body padding applies directly when no media is present."
        links={{ cta: { label: 'Learn more', href: '/about' } }}
      />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// Card surface variants
// ---------------------------------------------------------------------------

export const Flat: Story = {
  name: 'Elevation — flat',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard {...baseCopy} media={{ ...landscapeMedia }} elevation="flat" />
    </div>
  ),
}

export const Bordered: Story = {
  name: 'Elevation — bordered',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard {...baseCopy} media={{ ...landscapeMedia }} elevation="bordered" />
    </div>
  ),
}

export const ColorDark: Story = {
  name: 'Colour — dark',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard
        title="Dark surface card"
        description="Coloured surfaces automatically apply a contrasting text colour."
        media={{ ...landscapeMedia }}
        color="dark"
      />
    </div>
  ),
}

export const ColorPrimary: Story = {
  name: 'Colour — primary',
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <MediaCard
        title="Primary surface card"
        description="Brand-coloured surface with automatic contrast text."
        color="primary"
        elevation="flat"
      />
    </div>
  ),
}

// ---------------------------------------------------------------------------
// In a grid — the natural use case
// ---------------------------------------------------------------------------

export const InGrid: Story = {
  name: 'In a grid — typical usage',
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1rem',
      }}
    >
      {[
        {
          seed: 'ql-mc-1',
          title: 'Spring collection',
          description: 'Lightweight warm-weather pieces.',
        },
        {
          seed: 'ql-mc-2',
          title: 'Summer essentials',
          description: 'Breathable fabrics for warmer days.',
        },
        {
          seed: 'ql-mc-3',
          title: 'Autumn edit',
          description: 'Transitional layers and earthy tones.',
        },
      ].map(({ seed, title, description }) => (
        <MediaCard
          key={seed}
          title={title}
          description={description}
          media={{
            mediaType: 'ManualImage' as const,
            image: {
              src: `https://picsum.photos/seed/${seed}/800/450`,
              alt: title,
              width: 800,
              height: 450,
            },
          }}
          links={{ href: `/collections/${seed}` }}
        />
      ))}
    </div>
  ),
}
