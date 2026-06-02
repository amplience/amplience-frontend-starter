import type { Meta, StoryObj } from '@storybook/react'

import { Icon, ICON_NAMES } from './Icon'

const meta: Meta<typeof Icon> = {
  title: 'Atoms/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    name: {
      control: 'select',
      options: Array.from(ICON_NAMES),
    },
    color: {
      control: 'select',
      options: [
        undefined,
        'primary',
        'secondary',
        'tertiary',
        'black',
        'white',
        'success',
        'info',
        'warning',
        'error',
      ],
    },
    size: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof Icon>

export const Playground: Story = {
  args: {
    name: 'star',
    size: 24,
  },
}

export const AllIcons: Story = {
  name: 'All icons',
  render: () => (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        padding: '1rem',
        alignItems: 'center',
      }}
    >
      {Array.from(ICON_NAMES).map((name) => (
        <div
          key={name}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
        >
          <Icon name={name} size={20} />
          <span
            style={{
              fontSize: '0.625rem',
              fontFamily: 'monospace',
              color: 'var(--color-gray-600)',
            }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const Colors: Story = {
  render: () => {
    const colors = [
      'primary',
      'secondary',
      'tertiary',
      'black',
      'success',
      'info',
      'warning',
      'error',
    ] as const
    return (
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          padding: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {colors.map((color) => (
          <div
            key={color}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <Icon name="star" size={24} color={color} label={color} />
            <span
              style={{
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                color: 'var(--color-gray-600)',
              }}
            >
              {color}
            </span>
          </div>
        ))}
        <div
          style={{
            background: 'var(--color-black)',
            padding: '0.5rem',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <Icon name="star" size={24} color="white" label="white" />
          <span
            style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--color-gray-400)' }}
          >
            white
          </span>
        </div>
      </div>
    )
  },
}

export const SizeScale: Story = {
  name: 'Explicit sizes',
  render: () => {
    const sizes = [12, 16, 20, 24, 32, 48] as const
    return (
      <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', alignItems: 'flex-end' }}>
        {sizes.map((size) => (
          <div
            key={size}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <Icon name="star" size={size} label={`${size}px`} />
            <span
              style={{
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                color: 'var(--color-gray-600)',
              }}
            >
              {size}px
            </span>
          </div>
        ))}
      </div>
    )
  },
}

export const InheritsTextSize: Story = {
  name: 'Inherits text size (1em default)',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      {(['h1', 'h3', 'p'] as const).map((tag) => {
        const El = tag
        return (
          <El key={tag} style={{ margin: 0 }}>
            <Icon name="star" /> {tag} context
          </El>
        )
      })}
    </div>
  ),
}
