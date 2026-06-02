import type { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { Typography } from '../Typography/Typography'
import { Button } from './Button'

const meta = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['solid', 'outlined', 'text'],
    },
    color: {
      control: 'select',
      options: ['black', 'white', 'primary', 'secondary'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof Button>

export const Playground: Story = {
  args: {
    children: 'Button label',
    variant: 'solid',
    color: 'black',
  },
}

export const AsButton: Story = {
  name: 'All variants — as <button>',
  render: () => {
    const variants = ['solid', 'outlined', 'text'] as const
    const colors = ['primary', 'secondary', 'tertiary', 'black', 'white'] as const

    return (
      <div
        style={{
          padding: '2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '2rem',
          background: 'linear-gradient(90deg, transparent 82%, var(--color-gray-900) 82%)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'subgrid',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption">Variant</Typography>
          {variants.map((variant) => (
            <Typography key={variant} variant="caption">
              {variant}
            </Typography>
          ))}
        </div>
        {colors.map((color) => (
          <div
            key={color}
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'subgrid',
              alignItems: 'center',
            }}
          >
            <Typography
              variant="caption"
              style={{ color: color === 'white' ? 'var(--color-white)' : undefined }}
            >
              {color}
            </Typography>
            {variants.map((variant) => (
              <Button key={variant} variant={variant} color={color}>
                Click me
              </Button>
            ))}
          </div>
        ))}
      </div>
    )
  },
}

export const AsLink: Story = {
  name: 'As <a> (href supplied)',
  render: () => (
    <div style={{ padding: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <Button href="/internal" variant="solid" color="primary">
        Internal link
      </Button>
      <Button href="https://amplience.com" variant="outlined" color="black">
        External link
      </Button>
      <Button href="/docs" variant="text" color="primary">
        Text link
      </Button>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div style={{ padding: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <Button variant="solid" color="primary" disabled>
        Solid disabled
      </Button>
      <Button variant="outlined" color="primary" disabled>
        Outlined disabled
      </Button>
      <Button variant="text" color="primary" disabled>
        Text disabled
      </Button>
    </div>
  ),
}

/**
 * CSS token smoke check — the only story in the package that asserts a
 * computed style value. Proves that the design token CSS loaded correctly in
 * Storybook; `toBeVisible()` alone would pass on an unstyled component.
 *
 * `--color-primary: #1553b6` resolves to `rgb(21, 83, 182)`. If the token
 * stylesheet is missing, the background will be empty or transparent and this
 * assertion will fail.
 */
export const CssCheck: Story = {
  name: 'CSS token check (automated)',
  args: { variant: 'solid', color: 'primary', children: 'CSS check' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'CSS check' })
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(21, 83, 182)')
  },
}
