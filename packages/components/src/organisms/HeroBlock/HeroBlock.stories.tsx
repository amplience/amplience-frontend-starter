import type { Meta, StoryObj } from '@storybook/react'

import { HeroBlock } from './HeroBlock'

const meta = {
  title: 'Organisms/HeroBlock',
  component: HeroBlock,
  tags: ['autodocs'],
  argTypes: {
    contentPositionMobile: {
      control: 'radio',
      options: ['overlay', 'beneath'],
    },
    contentPositionDesktop: {
      control: 'radio',
      options: ['overlay', 'beneath'],
    },
    heightBehaviour: {
      control: 'radio',
      options: ['flexible', 'fitToContent', 'fitToImage'],
    },
    verticalPosition: {
      control: 'radio',
      options: ['top', 'center', 'bottom'],
    },
    horizontalPosition: {
      control: 'radio',
      options: ['left', 'center', 'right'],
    },
    textAlign: {
      control: 'radio',
      options: ['left', 'center', 'right'],
    },
    maxWidth: {
      control: 'radio',
      options: ['narrow', 'default', 'wide', 'none'],
    },
    contentWidth: {
      control: {
        type: 'range',
        min: 0,
        max: 100,
      },
      description: 'Percentage width of the content panel.',
      table: {
        defaultValue: { summary: '50' },
      },
    },
    contentPadding: {
      control: { type: 'range', min: 0, step: 4 },
      description:
        'Custom content padding (px). Clear the field to use the CSS default (var(--site-gutter)).',
      table: {
        defaultValue: { summary: 'unset — uses var(--site-gutter)' },
      },
    },
    overlayStyle: {
      control: 'radio',
      options: ['gradient', 'solid', 'hard'],
      description: 'Style of the image overlay scrim.',
    },
    overlayIntensity: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description:
        'Overlay opacity (0–100). Set per-image: right value depends on image content and scrim colour.',
    },
    textColor: {
      control: 'select',
      options: [undefined, 'primary', 'secondary', 'tertiary', 'white', 'light', 'dark', 'black'],
      description:
        'Text colour of the content panel. Overrides the default in both overlay and beneath modes.',
    },
    overlayColor: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'white', 'light', 'dark', 'black'],
      description: 'Overlay colour — applied to the image overlay scrim. Defaults to black.',
    },
    backgroundColor: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'white', 'light', 'dark', 'black'],
      description:
        'Section background colour — fallback when no image, and placeholder during load.',
    },
  },
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof HeroBlock>

export default meta
type Story = StoryObj<typeof HeroBlock>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const landscapeImage = {
  src: 'https://picsum.photos/seed/ql-hero/1600/900',
  alt: 'Hero — landscape photo',
  width: 1600,
  height: 900,
} as const

const baseCopy = {
  title: 'Build composable sites without the boilerplate.',
  subtitle: 'Quadratic Lite is the open-source accelerator for Amplience-backed projects.',
} as const

const singleCta = [{ label: 'Get started', href: '/docs/getting-started' }] as const

const multiCta = [
  { label: 'Get started', href: '/docs/getting-started', variant: 'solid', color: 'white' },
  { label: 'Learn more', href: '/about', variant: 'outlined', color: 'white' },
] as const

// ---------------------------------------------------------------------------
// Playground — all controls enabled
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    image: { ...landscapeImage },
    ...baseCopy,
    ctas: [...singleCta],
    contentPositionMobile: 'overlay',
    contentPositionDesktop: 'overlay',
    heightBehaviour: 'flexible',
    verticalPosition: 'top',
    horizontalPosition: 'left',
    textAlign: 'left',
    textColor: undefined,
    maxWidth: 'default',
    contentWidth: 50,
    contentPadding: undefined,
    overlayIntensity: 50,
    overlayStyle: 'gradient',
    overlayColor: 'black',
    backgroundColor: 'dark',
  },
}

// ---------------------------------------------------------------------------
// No image
// ---------------------------------------------------------------------------

export const TextOnly: Story = {
  name: 'No image — text only',
  args: {
    ...baseCopy,
    ctas: [...singleCta],
  },
}

export const BackgroundColor: Story = {
  name: 'Background colour — no image',
  args: {
    ...baseCopy,
    ctas: [...singleCta],
    backgroundColor: 'primary',
  },
}

// ---------------------------------------------------------------------------
// Beneath layout
// ---------------------------------------------------------------------------

export const Beneath: Story = {
  name: 'Beneath — image above, content below',
  args: {
    ...baseCopy,
    ctas: [...singleCta],
    image: { ...landscapeImage },
    contentPositionMobile: 'beneath',
    contentPositionDesktop: 'beneath',
    textColor: 'dark',
  },
}

// ---------------------------------------------------------------------------
// Overlay — height behaviour variants
// ---------------------------------------------------------------------------

export const OverlayFlexible: Story = {
  name: 'Overlay — flexible (default)',
  args: {
    ...baseCopy,
    ctas: [...multiCta],
    image: { ...landscapeImage },
    contentPositionMobile: 'overlay',
    contentPositionDesktop: 'overlay',
    heightBehaviour: 'flexible',
  },
}

export const HeightConstraints: Story = {
  name: 'Height constraints (minHeight / maxHeight)',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <HeroBlock
        title="minHeight 400 — short content, guaranteed presence"
        backgroundColor="dark"
        minHeight={400}
      />
      <HeroBlock
        title="minHeight 400 + verticalPosition center — content centred in the slack"
        backgroundColor="primary"
        minHeight={400}
        verticalPosition="center"
        horizontalPosition="center"
        textAlign="center"
      />
      <HeroBlock
        {...baseCopy}
        title="maxHeight 280 — tall image capped and clipped"
        image={{ ...landscapeImage }}
        contentPositionMobile="overlay"
        contentPositionDesktop="overlay"
        heightBehaviour="flexible"
        overlayIntensity={50}
        maxHeight={280}
      />
    </div>
  ),
}

export const OverlayFitToContent: Story = {
  name: 'Overlay — fitToContent (image crops)',
  args: {
    ...baseCopy,
    ctas: [...multiCta],
    image: { ...landscapeImage },
    contentPositionMobile: 'overlay',
    contentPositionDesktop: 'overlay',
    heightBehaviour: 'fitToContent',
  },
}

export const OverlayFitToImage: Story = {
  name: 'Overlay — fitToImage (image ratio preserved)',
  args: {
    ...baseCopy,
    ctas: [...multiCta],
    image: { ...landscapeImage },
    contentPositionMobile: 'overlay',
    contentPositionDesktop: 'overlay',
    heightBehaviour: 'fitToImage',
  },
}

// ---------------------------------------------------------------------------
// Cross-device position
// ---------------------------------------------------------------------------

export const BeneathMobileOverlayDesktop: Story = {
  name: 'Beneath on mobile, overlay on desktop',
  args: {
    ...baseCopy,
    ctas: [...multiCta],
    image: { ...landscapeImage },
    contentPositionMobile: 'beneath',
    contentPositionDesktop: 'overlay',
    heightBehaviour: 'flexible',
    backgroundColor: 'dark',
  },
}

// ---------------------------------------------------------------------------
// Multiple CTAs
// ---------------------------------------------------------------------------

export const MultipleCtas: Story = {
  name: 'Multiple CTAs',
  args: {
    ...baseCopy,
    ctas: [...multiCta],
    image: { ...landscapeImage },
  },
}

// ---------------------------------------------------------------------------
// Minimal — title only
// ---------------------------------------------------------------------------

export const TitleOnly: Story = {
  name: 'Title only',
  args: {
    title: 'Welcome.',
  },
}
