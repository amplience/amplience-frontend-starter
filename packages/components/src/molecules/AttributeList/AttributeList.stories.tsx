import type { Meta, StoryObj } from '@storybook/react'

import { AttributeList } from './AttributeList'

const meta = {
  title: 'Molecules/AttributeList',
  component: AttributeList,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'padded',
  },
} satisfies Meta<typeof AttributeList>

export default meta
type Story = StoryObj<typeof AttributeList>

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    attributes: [
      { label: 'Frame', value: 'Oiled oak' },
      { label: 'Upholstery', value: 'Wool bouclé' },
      { label: 'Dimensions', value: '78 × 82 × 71 cm' },
    ],
  },
}

export const SingleRow: Story = {
  name: 'One attribute',
  args: { attributes: [{ label: 'Material', value: 'Glazed stoneware' }] },
}

export const LongValues: Story = {
  name: 'Wrapping values',
  args: {
    attributes: [
      { label: 'Material', value: '100% undyed wool, woven on a hand loom in the Welsh borders' },
      {
        label: 'Care',
        value:
          'Dry clean only. Do not tumble dry, do not bleach, cool iron on the reverse if needed.',
      },
    ],
  },
}

export const Empty: Story = {
  name: 'Empty — renders nothing',
  args: { attributes: [] },
}
