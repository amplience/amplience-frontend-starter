import type { Meta, StoryObj } from '@storybook/react'

import { Placeholder } from '../../atoms/Placeholder/Placeholder'
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
// ---------------------------------------------------------------------------

function slides(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <Placeholder key={index} height={220} text={`Slide ${index + 1}`} />
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
    scrollStep: 'slide',
    label: 'Featured products',
  },
  render: (args) => <Carousel {...args}>{slides(8)}</Carousel>,
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
          'With both sets of controls off and the scrollbar on, the component ships no ' +
          'interactive JavaScript at all — the track is a plain CSS scroll-snap container.',
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
          'dots are omitted rather than rendered inert.',
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
