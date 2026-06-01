import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlaceholderProps = {
  /** Optional label rendered centred inside the box. */
  text?: ReactNode
  /** Explicit height. Defaults to a fixed height when no text is provided. */
  height?: string | number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A visual placeholder for use in smoke tests and Storybook only — never
 * rendered in the live site. Renders a dashed, centred box that makes layout
 * structure visible without needing real content.
 *
 * Usage:
 *   <Placeholder />                            — blank fixed-height box
 *   <Placeholder text='maxWidth="narrow"' />   — labelled box
 *   <Placeholder height={80} />                — custom height
 */
export function Placeholder({ text, height }: PlaceholderProps) {
  return (
    <div
      style={{
        background: 'var(--color-gray-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--gap)',
        borderRadius: 'var(--radius)',
        border: 'dashed 2px var(--color-gray-400)',
        minHeight: height ?? (text ? undefined : 28),
        fontSize: '0.75rem',
        color: 'var(--color-gray-600)',
        fontFamily: 'monospace',
      }}
    >
      {text}
    </div>
  )
}
