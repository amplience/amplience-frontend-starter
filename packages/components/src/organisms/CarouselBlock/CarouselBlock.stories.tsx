import type { Meta, StoryObj } from '@storybook/react'

import { MediaCard } from '../../molecules/MediaCard/MediaCard'
import { MarkdownBlock } from '../MarkdownBlock/MarkdownBlock'
import { CarouselBlock } from './CarouselBlock'

const meta = {
  title: 'Organisms/CarouselBlock',
  component: CarouselBlock,
  tags: ['autodocs'],
  argTypes: {
    slidesMobile: {
      control: { type: 'number', min: 1, max: 6, step: 0.1 },
      description: 'Slides visible below 769px. Fractional values above 1 give a peek affordance.',
    },
    slidesTablet: {
      control: { type: 'number', min: 1, max: 6, step: 0.1 },
      description: 'Slides visible from 769px.',
    },
    slidesDesktop: {
      control: { type: 'number', min: 1, max: 6, step: 0.1 },
      description: 'Slides visible from 992px.',
    },
    gap: {
      control: { type: 'range', min: 0, max: 64, step: 4 },
    },
    scrollStep: {
      control: 'inline-radio',
      options: ['slide', 'page'],
    },
    showArrows: { control: 'boolean' },
    showDots: { control: 'boolean' },
    showScrollbar: { control: 'boolean' },
    dragToScroll: { control: 'boolean' },
    maxWidth: {
      control: 'radio',
      options: ['narrow', 'default', 'wide', 'none'],
    },
    gutter: { control: 'boolean' },
    backgroundColor: {
      control: 'select',
      options: [undefined, 'primary', 'secondary', 'tertiary', 'white', 'light', 'dark', 'black'],
    },
    children: { control: false },
  },
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CarouselBlock>

export default meta
type Story = StoryObj<typeof CarouselBlock>

// ---------------------------------------------------------------------------
// Slide helpers
//
// Cards are linked so the drag-versus-click behaviour is exercised in the
// wrapper too, not just in the molecule's own stories.
// ---------------------------------------------------------------------------

function cards(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <MediaCard
      key={index}
      title={`Item ${index + 1}`}
      description="Click the CTA, or drag anywhere on the card to scroll the track."
      links={{ cta: { label: 'View', href: `#item-${index + 1}` } }}
      elevation="bordered"
    />
  ))
}

function quotes() {
  return [
    'Genuinely the fastest we have ever launched a campaign. — **Head of Digital**',
    'Our editors stopped filing tickets and started publishing. — **Content Lead**',
    'The design system paid for itself in the first quarter. — **CTO**',
  ].map((content, index) => <MarkdownBlock key={index} content={content} bare />)
}

// ---------------------------------------------------------------------------
// Playground — all controls enabled
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    sectionHeader: { title: 'New in', description: 'Fresh stock, restocked weekly.' },
    slidesMobile: 1,
    slidesTablet: 2,
    slidesDesktop: 3,
    showArrows: true,
    showDots: true,
    showScrollbar: false,
    dragToScroll: true,
    scrollStep: 'slide',
    maxWidth: 'default',
    gutter: true,
  },
  render: (args) => <CarouselBlock {...args}>{cards(8)}</CarouselBlock>,
}

// ---------------------------------------------------------------------------
// The common shapes
// ---------------------------------------------------------------------------

export const CardRail: Story = {
  name: 'Card rail',
  parameters: {
    docs: {
      description: {
        story: 'The overwhelmingly common case: a row of linked MediaCards under a section header.',
      },
    },
  },
  render: () => (
    <CarouselBlock
      sectionHeader={{ title: 'New in' }}
      slidesMobile={1}
      slidesTablet={2}
      slidesDesktop={4}
      gutter
    >
      {cards(10)}
    </CarouselBlock>
  ),
}

export const GutterBleed: Story = {
  name: 'Gutter — track bleeds into it',
  parameters: {
    docs: {
      description: {
        story:
          'Scroll this one. Slide one still lines up with the section header, but the previous ' +
          'and next slides show through into the gutter instead of being cut dead on the content ' +
          'edge — which is where a reader looks for evidence there is more to scroll to. ' +
          'Automatic whenever the block has a gutter; nothing to configure. Compare with the ' +
          'card rail above, which is the same layout.',
      },
    },
  },
  render: () => (
    <CarouselBlock
      sectionHeader={{ title: 'Benefits', description: 'The bleed is the width of the gutter.' }}
      slidesMobile={1.2}
      slidesTablet={2}
      slidesDesktop={3}
      backgroundColor="dark"
      gutter
    >
      {cards(10)}
    </CarouselBlock>
  ),
}

export const EdgeToEdgePeek: Story = {
  name: 'Edge to edge with a peek',
  parameters: {
    docs: {
      description: {
        story:
          'No gutter, fractional slide counts. Slides run to the viewport edge and part of the ' +
          'next one stays in view, which is how a touch user discovers the track scrolls at all.',
      },
    },
  },
  render: () => (
    <CarouselBlock
      sectionHeader={{ title: 'Shop the look' }}
      slidesMobile={1.2}
      slidesTablet={2.4}
      slidesDesktop={3.4}
      maxWidth="none"
    >
      {cards(10)}
    </CarouselBlock>
  ),
}

export const QuoteCarousel: Story = {
  name: 'Quote carousel (markdown slides)',
  parameters: {
    docs: {
      description: {
        story:
          'One-up rich text. Nothing in the block knows that these are markdown rather than cards ' +
          '— the item array is untyped by design, which is also why a mixed carousel needs no ' +
          'extra content type (ADR-0020).',
      },
    },
  },
  render: () => (
    <CarouselBlock
      sectionHeader={{ title: 'What customers say' }}
      slidesMobile={1}
      slidesTablet={1}
      slidesDesktop={1}
      backgroundColor="light"
      maxWidth="narrow"
      gutter
    >
      {quotes()}
    </CarouselBlock>
  ),
}

export const Mixed: Story = {
  name: 'Mixed item types',
  parameters: {
    docs: {
      description: {
        story:
          'Cards and rich text in one track. Expected to be rare — but it costs nothing to ' +
          'support, because the item array was never told what it holds.',
      },
    },
  },
  render: () => (
    <CarouselBlock
      sectionHeader={{ title: 'Editorial mix' }}
      slidesMobile={1}
      slidesTablet={2}
      slidesDesktop={3}
      gutter
    >
      {cards(3)}
      {quotes()}
    </CarouselBlock>
  ),
}

// ---------------------------------------------------------------------------
// Section chrome
// ---------------------------------------------------------------------------

export const NoSectionHeader: Story = {
  name: 'No section header',
  parameters: {
    docs: {
      description: {
        story:
          'With no title there is nothing to name the carousel after, so it falls back to the ' +
          'molecule default of "Carousel" — worth avoiding on a page with more than one.',
      },
    },
  },
  render: () => (
    <CarouselBlock slidesDesktop={3} gutter>
      {cards(8)}
    </CarouselBlock>
  ),
}

export const BackgroundDark: Story = {
  name: 'Background — dark',
  render: () => (
    <CarouselBlock
      sectionHeader={{ title: 'Featured' }}
      backgroundColor="dark"
      slidesDesktop={3}
      gutter
    >
      {cards(8)}
    </CarouselBlock>
  ),
}

export const WideContainer: Story = {
  name: 'Wide container — 4 up',
  render: () => (
    <CarouselBlock sectionHeader={{ title: 'Browse all' }} maxWidth="wide" slidesDesktop={4} gutter>
      {cards(12)}
    </CarouselBlock>
  ),
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

export const NotEnoughToScroll: Story = {
  name: 'Fewer items than fit',
  parameters: {
    docs: {
      description: {
        story:
          'Measured, not assumed: with everything already visible the arrows and dots are omitted ' +
          'and the grab cursor is withheld, because a drag would move nothing.',
      },
    },
  },
  render: () => (
    <CarouselBlock sectionHeader={{ title: 'Just two' }} slidesDesktop={3} gutter>
      {cards(2)}
    </CarouselBlock>
  ),
}
