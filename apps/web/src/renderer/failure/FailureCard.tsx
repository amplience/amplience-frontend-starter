import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FailureCardProps = {
  /** Failure class, displayed as the card's eyebrow label. */
  failureClass: string
  /** One-sentence, user-friendly summary. Identical in dev and prod. */
  summary: string
  /** The schema URI involved, displayed in monospace beneath the summary. */
  schemaUri: string
  /**
   * Diagnostic detail rendered inside an expandable `<details>` block —
   * development only. Production renders the card without it (ADR-0010 §7).
   */
  diagnostics?: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Evaluated at module load, per ADR-0010 §8.
const isDev = process.env.NODE_ENV === 'development'

/**
 * Shared chrome for the renderer's loud-failure cards (ADR-0010 §5B).
 *
 * One card, both environments: brand-styled, short, user-friendly. The three
 * failure classes share this frame and vary only their body text. Dev mode
 * adds an expandable diagnostics block — native `<details>`, so the card
 * needs no client JavaScript and the renderer stays a Server Component all
 * the way down.
 */
export function FailureCard({ failureClass, summary, schemaUri, diagnostics }: FailureCardProps) {
  return (
    <section
      role="alert"
      data-renderer-failure={failureClass}
      style={{
        background: 'var(--color-gray-100)',
        border: 'solid 1px var(--color-gray-400)',
        borderLeft: 'solid 4px var(--color-error, #b3261e)',
        borderRadius: 'var(--radius)',
        padding: 'var(--gap)',
        margin: 'var(--gap) 0',
        color: 'var(--color-gray-600)',
        fontSize: '0.875rem',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.6875rem',
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {failureClass}
      </p>
      <p style={{ margin: 'calc(var(--gap) / 2) 0 0' }}>{summary}</p>
      <p style={{ margin: 'calc(var(--gap) / 2) 0 0', fontFamily: 'monospace' }}>{schemaUri}</p>

      {isDev && diagnostics != null && (
        <details style={{ marginTop: 'calc(var(--gap) / 2)' }}>
          <summary style={{ cursor: 'pointer' }}>Diagnostics (development only)</summary>
          <div style={{ marginTop: 'calc(var(--gap) / 2)', fontFamily: 'monospace' }}>
            {diagnostics}
          </div>
        </details>
      )}
    </section>
  )
}
