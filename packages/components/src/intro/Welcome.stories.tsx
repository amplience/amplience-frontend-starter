import { linkTo } from '@storybook/addon-links'
import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../atoms/Button/Button'
import { Card } from '../atoms/Card/Card'
import { Divider } from '../atoms/Divider/Divider'
import { Icon } from '../atoms/Icon/Icon'
import { Typography } from '../atoms/Typography/Typography'

/**
 * Welcome page — the default landing story for this Storybook.
 *
 * Introduces Atomic Design and the brand theming toolbar.
 * Sorted first via the `storySort` order in .storybook/preview.tsx.
 */

// Inline component so this file stays self-contained with no external deps.
function Welcome() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 32px',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        color: 'var(--color-text, #111)',
        lineHeight: 1.6,
      }}
    >
      {/* Header */}
      <Typography variant="h1">Amplience Frontend Starter Component Library</Typography>
      <Typography
        style={{ fontSize: '1.125rem', color: 'var(--color-text-muted, #555)', marginTop: 0 }}
      >
        A living catalogue of the UI components that power Amplience Frontend Starter sites.
      </Typography>

      <Divider />

      {/* Atomic Design */}
      <Typography variant="h2">Atomic Design</Typography>
      <Typography>
        Components are organised using <strong>Atomic Design</strong> — a methodology that builds
        UIs from the simplest indivisible units up to complete page layouts:
      </Typography>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          margin: '20px 0 28px',
        }}
      >
        {[
          {
            label: 'Atoms',
            emoji: '⚛️',
            desc: 'The smallest building blocks — Button, Typography, Icon, Image.',
          },
          {
            label: 'Molecules',
            emoji: '🧪',
            desc: 'Groups of atoms that work together — MediaCard, Markdown.',
          },
          {
            label: 'Organisms',
            emoji: '🧬',
            desc: 'Complex, reusable sections — HeroBlock, GridBlock, ColumnsBlock.',
          },
          {
            label: 'Templates',
            emoji: '📐',
            desc: 'Page-level layouts that arrange organisms into a structure.',
          },
        ].map(({ label, emoji, desc }) => (
          <Card elevation="bordered" key={label}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{emoji}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #555)' }}>
              {desc}
            </div>
          </Card>
        ))}
      </div>

      <Typography>
        Browse each group in the left-hand panel. Most stories include a <strong>Playground</strong>{' '}
        variant with live controls so you can tweak props interactively, plus an{' '}
        <strong>Autodocs</strong> tab with the full prop API.
      </Typography>

      <Divider />

      {/* Brand theming */}
      <Typography variant="h2">Brand Theming</Typography>
      <Typography>
        Every component is styled through <strong>CSS design tokens</strong> and a{' '}
        <code
          style={{
            background: 'var(--color-surface, #f0f0f0)',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: '0.875em',
          }}
        >
          [data-brand]
        </code>{' '}
        attribute — no component logic changes between brands.
      </Typography>
      <Typography>
        Use the <strong>Brand</strong> dropdown in the toolbar at the top of the page to switch
        between available brand themes and preview any component as it would appear in that
        storefront.
      </Typography>

      <Card
        elevation="bordered"
        style={{
          marginTop: 4,
        }}
      >
        💡 Try switching themes now — the elements on this page will update to reflect each
        brand&apos;s token overrides, such as the buttons and icons below ↓
      </Card>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <Button variant="outlined" onClick={linkTo('Atoms/Button', 'All variants & colors')}>
          See Buttons
        </Button>
        <Button
          variant="solid"
          color="secondary"
          onClick={linkTo('Atoms/Typography', 'Type Scale')}
        >
          See Typography
        </Button>
        <Icon name="search" size={20} color="primary" label="Search" />
        <Icon name="shopping-bag" size={20} color="secondary" label="Search" />
        <Icon name="user" size={20} color="tertiary" label="Search" />
      </div>

      <Divider />

      {/* CTA */}
      <Typography>Ready? Pick a category from the panel on the left to start exploring.</Typography>
    </div>
  )
}

const meta = {
  title: 'Intro',
  component: Welcome,
  parameters: {
    layout: 'fullscreen',
    // No controls needed for a static doc page
    controls: { disable: true },
    docs: { disable: true },
  },
  tags: [],
} satisfies Meta<typeof Welcome>

export default meta
type Story = StoryObj<typeof Welcome>

export const Intro: Story = {}
