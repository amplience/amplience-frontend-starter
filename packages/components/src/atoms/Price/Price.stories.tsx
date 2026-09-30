import type { Meta, StoryObj } from '@storybook/react'

import { Price } from './Price'

const meta = {
  title: 'Atoms/Price',
  component: Price,
  tags: ['autodocs'],
  argTypes: {
    amount: { control: 'number' },
    currencyCode: { control: 'text' },
    locale: { control: 'text' },
  },
  parameters: {
    controls: { disable: true },
    layout: 'padded',
  },
} satisfies Meta<typeof Price>

export default meta
type Story = StoryObj<typeof Price>

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: {
    amount: 749,
    currencyCode: 'GBP',
    locale: 'en-GB',
  },
}

export const Locales: Story = {
  name: 'Same amount, different locales',
  render: () => (
    <table style={{ borderCollapse: 'collapse' }}>
      <tbody>
        {(
          [
            ['en-GB', 'GBP'],
            ['en-US', 'USD'],
            ['de-DE', 'EUR'],
            ['fr-FR', 'EUR'],
            ['ja-JP', 'JPY'],
          ] as const
        ).map(([locale, currencyCode]) => (
          <tr key={locale}>
            <td style={{ padding: '0.25rem 1rem 0.25rem 0', opacity: 0.6 }}>{locale}</td>
            <td style={{ padding: '0.25rem 0' }}>
              <Price amount={1234.5} currencyCode={currencyCode} locale={locale} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}

export const MinorUnits: Story = {
  name: 'Minor units vary by currency',
  render: () => (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <Price amount={749} currencyCode="GBP" locale="en-GB" />
      <Price amount={749} currencyCode="JPY" locale="en-GB" />
      <Price amount={749} currencyCode="BHD" locale="en-GB" />
    </div>
  ),
}

export const Degraded: Story = {
  name: 'Unknown currency code',
  render: () => <Price amount={749} currencyCode="NOTACODE" locale="en-GB" />,
}
