import type { Meta, StoryObj } from '@storybook/react'

import { MediaCard } from '../MediaCard/MediaCard'
import { Carousel } from './Carousel'

const meta = {
  title: 'Molecules/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  argTypes: {
    slidesMobile: {
      control: { type: 'number', min: 0.5, max: 6, step: 0.1 },
      description: 'Slides visible below 769px. Fractional values give a peek affordance.',
    },
    slidesTablet: {
      control: { type: 'number', min: 0.5, max: 6, step: 0.1 },
      description: 'Slides visible from 769px.',
    },
    slidesDesktop: {
      control: { type: 'number', min: 0.5, max: 6, step: 0.1 },
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
    children: { control: false },
  },
  parameters: {
    controls: { disable: true },
    layout: 'padded',
  },
} satisfies Meta<typeof Carousel>

export default meta
type Story = StoryObj<typeof Carousel>

// ---------------------------------------------------------------------------
// Slide helper
//
// Every slide is a fully-linked MediaCard on purpose. A carousel of inert boxes
// proves nothing about the drag gesture — the thing worth checking is that a
// click still follows the link while a drag does not.
// ---------------------------------------------------------------------------

function slides(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <MediaCard
      key={index}
      title={`Slide ${index + 1}`}
      description="You can click+drag on the card, but also still interact with the CTA links inside it. The drag gesture is only recognised after the pointer has moved 6px, so a click on a link still follows its href."
      links={{ cta: { label: 'Click Me', href: `https://www.bbc.co.uk` } }}
      elevation="bordered"
    />
  ))
}

// ---------------------------------------------------------------------------
// Playground — all controls enabled
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    slidesMobile: 1,
    slidesTablet: 2,
    slidesDesktop: 3,
    showArrows: true,
    showDots: true,
    showScrollbar: false,
    dragToScroll: true,
    scrollStep: 'slide',
    label: 'Featured products',
  },
  render: (args) => <Carousel {...args}>{slides(8)}</Carousel>,
}

// ---------------------------------------------------------------------------
// Drag to scroll
// ---------------------------------------------------------------------------

export const DragToScroll: Story = {
  name: 'Drag to scroll (mouse)',
  parameters: {
    docs: {
      description: {
        story:
          'Press anywhere on the track and drag. The cursor is `grab`, except over a link, ' +
          'which keeps its own `pointer` — and `grabbing` everywhere for the duration of the ' +
          'gesture. Nothing moves until the pointer has travelled 6px, so a click on a card ' +
          'still follows its link; past that the drag scrolls, snap is suspended so the track ' +
          'tracks the pointer, and the click the release produces is swallowed. On touch this ' +
          "is all inert — the browser's own momentum scrolling is better than anything we " +
          'would write.',
      },
    },
  },
  render: () => (
    <Carousel slidesMobile={1.2} slidesTablet={2.4} slidesDesktop={3.4} label="Shop the look">
      {slides(10)}
    </Carousel>
  ),
}

export const DragDisabled: Story = {
  name: 'Drag turned off',
  parameters: {
    docs: {
      description: {
        story:
          'For slides whose content wants the drag gesture for itself — a map, a range input, ' +
          'a colour picker. Native scrolling, the arrows and the dots are all unaffected, and ' +
          'the grab cursor is gone.',
      },
    },
  },
  render: () => (
    <Carousel dragToScroll={false} label="Browse by category">
      {slides(8)}
    </Carousel>
  ),
}

// ---------------------------------------------------------------------------
// Slides per view
// ---------------------------------------------------------------------------

export const OneUp: Story = {
  name: 'One slide at a time',
  render: () => (
    <Carousel slidesMobile={1} slidesTablet={1} slidesDesktop={1} label="Customer quotes">
      {slides(5)}
    </Carousel>
  ),
}

export const FourUpDesktop: Story = {
  name: '1 / 2 / 4 slides per breakpoint',
  render: () => (
    <Carousel slidesMobile={1} slidesTablet={2} slidesDesktop={4} label="New arrivals">
      {slides(10)}
    </Carousel>
  ),
}

export const FractionalPeek: Story = {
  name: 'Fractional slides — peek affordance',
  parameters: {
    docs: {
      description: {
        story:
          'Fractional slide counts leave part of the next slide in view, which is how a touch ' +
          'user discovers the track scrolls at all. Useful on mobile, where arrows are small ' +
          'and dots are easy to miss.',
      },
    },
  },
  render: () => (
    <Carousel slidesMobile={1.2} slidesTablet={2.4} slidesDesktop={3.4} label="Shop the look">
      {slides(8)}
    </Carousel>
  ),
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export const DotsOnly: Story = {
  name: 'Dots only',
  render: () => (
    <Carousel showArrows={false} label="Editorial highlights">
      {slides(8)}
    </Carousel>
  ),
}

export const ArrowsOnly: Story = {
  name: 'Arrows only',
  render: () => (
    <Carousel showDots={false} label="Editorial highlights">
      {slides(8)}
    </Carousel>
  ),
}

export const ScrollbarAffordance: Story = {
  name: 'Scrollbar as the affordance',
  parameters: {
    docs: {
      description: {
        story:
          'Arrows and dots off, scrollbar on — the scrollbar is then the only visible sign the ' +
          'track scrolls. Worth pairing with dragToScroll, since a scrollbar is a small target. ' +
          'Note that turning every affordance off leaves no single-pointer alternative to ' +
          'dragging (WCAG 2.5.7), which is a reason to keep at least one of them.',
      },
    },
  },
  render: () => (
    <Carousel showArrows={false} showDots={false} showScrollbar label="Browse all">
      {slides(12)}
    </Carousel>
  ),
}

export const PagedScrolling: Story = {
  name: 'Arrows advance a full page',
  render: () => (
    <Carousel scrollStep="page" slidesDesktop={4} label="Browse by category">
      {slides(12)}
    </Carousel>
  ),
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

export const NotEnoughToScroll: Story = {
  name: 'Fewer slides than fit — controls suppressed',
  parameters: {
    docs: {
      description: {
        story:
          'The controls are measured, not assumed: when everything already fits, the arrows and ' +
          'dots are omitted rather than rendered inert, and the grab cursor is withheld because ' +
          'a drag would move nothing.',
      },
    },
  },
  render: () => (
    <Carousel slidesMobile={1} slidesTablet={2} slidesDesktop={3} label="Two things">
      {slides(2)}
    </Carousel>
  ),
}

export const WideGap: Story = {
  name: 'Custom gap',
  render: () => (
    <Carousel gap={48} slidesDesktop={3} label="Spaced out">
      {slides(8)}
    </Carousel>
  ),
}
