import type { Meta, StoryObj } from '@storybook/react'

import { Placeholder } from '../../atoms/Placeholder/Placeholder'
import { Slot } from '../../organisms/Slot/Slot'
import { Page } from './Page'

const meta = {
  title: 'Templates/Page',
  component: Page,
  tags: ['autodocs'],
  parameters: { controls: { disable: true }, layout: 'padded' },
} satisfies Meta<typeof Page>

export default meta
type Story = StoryObj<typeof Page>

export const Default: Story = {
  name: 'Slots in content order',
  render: () => (
    <Page>
      <Slot name="page/main">
        <Placeholder text="hero" height={120} />
        <Placeholder text="content" height={160} />
      </Slot>
      <Slot name="page/footer-promo">
        <Placeholder text="promo banner" height={64} />
      </Slot>
    </Page>
  ),
}
