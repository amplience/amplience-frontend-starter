import type { Meta, StoryObj } from '@storybook/react'

import { AnnouncementBar } from './AnnouncementBar'

const PALETTE = ['primary', 'secondary', 'tertiary', 'light', 'dark', 'black', 'white']

const meta = {
  title: 'Organisms/AnnouncementBar',
  component: AnnouncementBar,
  tags: ['autodocs'],
  argTypes: {
    backgroundColor: { control: 'select', options: PALETTE },
    textColor: { control: 'select', options: PALETTE },
    textAlign: { control: 'radio', options: ['left', 'center', 'right'] },
    maxWidth: { control: 'radio', options: ['narrow', 'default', 'wide', 'none'] },
    dismissible: { control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AnnouncementBar>

export default meta
type Story = StoryObj<typeof AnnouncementBar>

export const Default: Story = {
  name: 'Default',
  args: { message: 'Free standard delivery on all orders' },
}

export const WithLink: Story = {
  name: 'Whole-bar link with link text',
  args: { message: '**Extra 20% off** the Mid-Season Sale', href: '/sale', linkLabel: 'Shop now' },
}

export const UnlabelledLink: Story = {
  name: 'Whole-bar link, no link text',
  args: { message: 'Extra 20% off the Mid-Season Sale', href: '/sale' },
}

export const InlineLink: Story = {
  name: 'Inline markdown link',
  args: { message: 'New season styles have landed — [see what’s new](/new)' },
}

export const Dismissible: Story = {
  name: 'Dismissible',
  // A per-story id, so dismissing here doesn't hide the other stories' bars.
  args: {
    message: 'Stores close at 4pm on Sunday',
    dismissible: true,
    id: 'storybook-dismissible',
  },
}

export const Tertiary: Story = {
  name: 'Background — tertiary',
  args: { message: 'Members get early access to the sale', backgroundColor: 'tertiary' },
}

export const LeftAligned: Story = {
  name: 'Left aligned, light',
  args: {
    message: 'Order by 2pm for next-day delivery',
    backgroundColor: 'light',
    textAlign: 'left',
    href: '/delivery',
    linkLabel: 'Delivery options',
  },
}
